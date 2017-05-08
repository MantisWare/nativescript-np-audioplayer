import { AudioPlayerState, fixPath, IAudioPlayer } from "./audioplayer.common";
import { Observable } from "data/observable";

export { AudioPlayerState };

// Proxy for key path observing since AudioPlayer can't extend both Observable and NSObject
class AudioPlayerKeyPathObserver extends NSObject {

    // Reference to the AudioPlayer
    private _owner: WeakRef<AudioPlayer>;

    // Create a new instance and set the owner
    public static initWithOwner(owner: WeakRef<AudioPlayer>): AudioPlayerKeyPathObserver {
        let handler = <AudioPlayerKeyPathObserver>AudioPlayerKeyPathObserver.new();
        handler._owner = owner;
        return handler;
    }

    // Forward key path events to the AudioPlayer
    public observeValueForKeyPathOfObjectChangeContext(keypath: string, source: Object, change: any, context: Object) {
        let owner = this._owner.get();
        if (owner) {
            owner.onKeyPathEvent(keypath, source, change, context);
        }
    }
}

export class AudioPlayer extends Observable implements IAudioPlayer {

    // Reference to the AudioPlayerKeyPathObserver
    private _keyPathObserver: AudioPlayerKeyPathObserver;

    constructor() {
        super();

        // Link to a new AudioPlayerKeyPathObserver
        this._keyPathObserver = AudioPlayerKeyPathObserver.initWithOwner(new WeakRef(this))
    }

    // Native variables
    private _ios: AVPlayer;
    get ios(): AVPlayer { return this._ios; }
    get android() { return undefined; }

    // External state
    private _state: AudioPlayerState = AudioPlayerState.Unloaded;
    get state(): AudioPlayerState { return this._state; }
    private setState(newState: AudioPlayerState) {
        this._state = newState;
        this.notifyPropertyChange("state", newState);
    }

    // Used to remember if a file should automaticaly play after being loaded
    private _shouldAutoplay = false;

    // Load an audio file/stream
    public loadAudio(uri: string, autoplay?: boolean) {

        // Store autoplay preference
        this._shouldAutoplay = !!autoplay;

        // If we had a previous error, clean up
        if (this._state == AudioPlayerState.Errored) {
            this.unload();
        }

        // If we don't have an AVPlayer, make a new one
        if (!this._ios) {

            // Init a new AVPlayer with the given path
            this._ios = AVPlayer.alloc().initWithURL(NSURL.URLWithString(fixPath(uri)));

            // Setup event observers
            this._setupItemObservers();
            this._setupPositionObserver();

        }
        // Otherwise reuse the one we have and replace the playing item
        else {

            // Stop and teardown event observers
            this._ios.pause();
            this._teardownItemObservers();

            // Clear old metadata
            this._externalMetadata = {};

            // Replace the current item
            this._ios.replaceCurrentItemWithPlayerItem(AVPlayerItem.alloc().initWithURL(NSURL.URLWithString(fixPath(uri))));

            // Setup event observers
            this._setupItemObservers();

        }

        // Setup the ios audio session
        this._setupAudioSession();

        // Set external state
        this.setState(AudioPlayerState.Loading);
    }

    // Track if we are observing the current item
    private _isObservingItem = false;

    // Setup key path listeners
    private _setupItemObservers() {
        if (this._ios && this._ios.currentItem) {
            if (this._isObservingItem) {
                this._teardownItemObservers();
            }
            this._ios.currentItem.addObserverForKeyPathOptionsContext(this._keyPathObserver, "status", NSKeyValueObservingOptions.Initial, null);
            this._ios.currentItem.addObserverForKeyPathOptionsContext(this._keyPathObserver, "duration", NSKeyValueObservingOptions.Initial, null);
            this._ios.currentItem.addObserverForKeyPathOptionsContext(this._keyPathObserver, "timeControlStatus", NSKeyValueObservingOptions.Initial, null);
            this._ios.currentItem.asset.addObserverForKeyPathOptionsContext(this._keyPathObserver, "metadata", NSKeyValueObservingOptions.Initial, null);
            this._isObservingItem = true;
        }
    }

    // Teardown key path listeners
    private _teardownItemObservers() {
        if (this._ios && this._ios.currentItem && this._isObservingItem) {
            this._ios.currentItem.removeObserverForKeyPathContext(this._keyPathObserver, "status", null);
            this._ios.currentItem.removeObserverForKeyPathContext(this._keyPathObserver, "duration", null);
            this._ios.currentItem.removeObserverForKeyPathContext(this._keyPathObserver, "timeControlStatus", null);
            this._ios.currentItem.asset.removeObserverForKeyPathContext(this._keyPathObserver, "metadata", null);
            this._isObservingItem = false;
        }
    }

    // AVPlayer doesn't start playing right away so track if we are waiting or not
    private _waitingForPlay = false;

    // Play the loaded media
    public play() {
        if (this._ios) {

            // Play the AVPlayer
            this._ios.play();
            this.setState(AudioPlayerState.Loading);
            this._waitingForPlay = true;
        }
    }

    // Pause the loaded media
    public pause() {
        if (this._ios) {

            // Clear autoplay preferance
            this._shouldAutoplay = false;

            // Pause the AVPlayer
            this._ios.pause();
            this.setState(AudioPlayerState.Paused);
        }
    }

    // Resumes the media (same as play)
    public resume() {
        this.play();
    }

    // Stops the media, but keeps it loaded and ready to play
    public stop() {
        this.pause();
        this.seekTo(0);
    }

    // Unloads the media, stopping all playback and freeing up resources
    public unload() {
        if (this._ios) {

            // Stop the player
            this._ios.pause();

            // Reset item metadata
            this._externalMetadata = {};

            // Teardown event observers
            this._teardownItemObservers();
            this._teardownPositionObserver();

            // Clear playing item
            this._ios.replaceCurrentItemWithPlayerItem(null);

            // Drop the player reference
            this._ios = null;

            // Stop the audio session
            this._teardownAudioSession();

            // Update state
            this.setState(AudioPlayerState.Unloaded);
        }
    }

    // Gets the duration in seconds
    public getDuration(): number {
        return (this._ios && this._ios.currentItem) ? CMTimeGetSeconds(this._ios.currentItem.duration) : -1;
    }

    // Gets the current play position in seconds
    public getPosition() {
        return this._ios ? CMTimeGetSeconds(this._ios.currentTime()) : -1;
    }

    // Sets the current play position in seconds
    public setPosition(seconds: number) {
        if (this._ios) {
            this._ios.seekToTime(CMTimeMakeWithSeconds(Math.round(seconds), 1));
        }
    }
    public seekTo(seconds: number) {
        this.setPosition(seconds);
    }

    // Get/Set the frequency of position update events in seconds
    private _positionUpdateFrequency = 1;

    public getPositionUpdateFrequency(): number {
        return this._positionUpdateFrequency;
    }

    public setPositionUpdateFrequency(seconds: number) {
        this._positionUpdateFrequency = seconds;
        this._setupPositionObserver();
    }

    // Setup/Teardown the position update observer
    private _positionObserver;
    private _setupPositionObserver() {
        if (this._ios) {
            this._teardownPositionObserver();

            this._positionObserver = this._ios.addPeriodicTimeObserverForIntervalQueueUsingBlock(
                CMTimeMakeWithSeconds(this._positionUpdateFrequency, 1),
                null,
                (positionCMTime: CMTime) => {
                    if (this._waitingForPlay) {
                        this.setState(AudioPlayerState.Playing);
                        this._waitingForPlay = false;
                    }
                    this.notifyPropertyChange("position", CMTimeGetSeconds(positionCMTime))

                }
            );
        }
    }

    private _teardownPositionObserver() {
        if (this._ios && this._positionObserver) {
            this._ios.removeTimeObserver(this._positionObserver);
            this._positionObserver = null;
        }
    }

    // Get/Set playback speed
    // Speed is a decimal number with 1.0 being normal speed
    public get canSetSpeed() {
        return true;
    }

    public getSpeed() {
        return this._ios ? this._ios.rate : 0;
    }

    public setSpeed(speed: number) {
        if (this._ios) {
            this._ios.rate = speed;
        }
    }

    // TODO: Implement looping
    private _currentLoop = 0;
    private _loopGoal = 0;
    public getLoopCount() {
        return this._currentLoop;
    }

    public setLoopCount(count: number) {
        this._currentLoop = count;
    }

    public getLoopCountGoal() {
        return this._loopGoal;
    }

    public setLoopCountGoal(count: number) {
        this._loopGoal = count;
    }

    // Get/Set the player volume
    // Volume is a number between 0.0 and 1.0
    public getVolume() {
        return this._ios ? this._ios.volume : -1;
    }

    public setVolume(decimalVolume: number) {
        if (this._ios) {
            this._ios.volume = decimalVolume;
        }
    }

    // On key path event
    public onKeyPathEvent(keypath: string, source: Object, change: any, context: Object) {
        if (keypath == "status") {
            if (this._ios.currentItem.status == AVPlayerItemStatus.ReadyToPlay) {
                if (this.state == AudioPlayerState.Loading) {
                    this.setState(AudioPlayerState.Loaded);
                    if (this._shouldAutoplay) {
                        this.play();
                    }
                }
            }
            else if (this._ios.currentItem.status == AVPlayerItemStatus.Failed) {
                this.setState(AudioPlayerState.Errored);
                const err = this._ios.currentItem.error;
                console.log(`[AVPlayer] Error: [${err.domain}:${err.code}] "${err.localizedDescription}": "${err.localizedFailureReason}"`);
            }
        }
        if (keypath == "timeControlStatus") {
            switch (this._ios.timeControlStatus) {
                case AVPlayerTimeControlStatus.Paused:
                    this.setState(AudioPlayerState.Paused);
                    break;
                case AVPlayerTimeControlStatus.Playing:
                    this.setState(AudioPlayerState.Playing);
                    break;
                case AVPlayerTimeControlStatus.WaitingToPlayAtSpecifiedRate:
                    this.setState(AudioPlayerState.Loading);
                    break;
            }
        }
        if (keypath == "duration") {
            this.notifyPropertyChange("duration", CMTimeGetSeconds(this._ios.currentItem.duration));
        }
        if (keypath == "metadata") {
            this.notifyPropertyChange("metadata", this.getCombinedMetadata());
        }
    }

    // Store the external metadata so we can merge it with metadata from the media
    // External metadata overrides internal metadata
    private _externalMetadata: Object = {};

    // Get merged internal and external metadata
    public getCombinedMetadata() {
        var metadata = {};
        if (this._ios && this._ios.currentItem && this._ios.currentItem.asset) {
            var internalMetadata = this._ios.currentItem.asset.metadata;
            if (internalMetadata) {
                var internalMetadataCount = internalMetadata.count;
                for (var i = 0; i < internalMetadataCount; ++i) {
                    var metaItem = internalMetadata.objectAtIndex(i)
                    metadata[metaItem.commonKey ? metaItem.commonKey : metaItem.key] = metaItem.stringValue || metaItem.dateValue || metaItem.numberValue;
                }
            }
        }
        for (var extMetaItem in this._externalMetadata) {
            metadata[extMetaItem] = this._externalMetadata[extMetaItem];
        }
        return metadata;
    }

    // Set external metadata
    public setExternalMetadata(metadata: Object) {
        this._externalMetadata = metadata;
        this.notifyPropertyChange("metadata", this.getCombinedMetadata());
    }

    // Setup the ios audio session
    public _setupAudioSession() {

        // Get the session instance
        const avSession = AVAudioSession.sharedInstance();

        // Set the category to normal playback
        avSession.setCategoryError(AVAudioSessionCategoryPlayback);

        // Activate the session
        avSession.setActiveError(true);
    }

    // Teardown the ios audio session
    public _teardownAudioSession() {

        // Get the session instance
        const avSession = AVAudioSession.sharedInstance();

        // Deactivate the session
        avSession.setActiveError(false);
    }

}