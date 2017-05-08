import { AudioPlayerState, fixPath, IAudioPlayer } from "./audioplayer.common";
import { Observable } from "data/observable";

export { AudioPlayerState };

// MediaPlayer doesn't expose it's state so we'll track it manually
enum InternalState {
    Idle,
    Initialized,
    Preparing,
    Prepared,
    Started,
    Paused,
    PlaybackCompleted,
    Stopped,
    End,
    Error
}

// MediaPlayer consts stored as reversable enum-like objects
const MEDIA_INFO = Object.keys(android.media.MediaPlayer).filter(p => p.startsWith("MEDIA_INFO_")).reduce((rtn, propName) => (rtn[rtn[propName] = android.media.MediaPlayer[propName]] = propName, rtn), {});
const MEDIA_ERROR = Object.keys(android.media.MediaPlayer).filter(p => p.startsWith("MEDIA_ERROR_")).reduce((rtn, propName) => (rtn[rtn[propName] = android.media.MediaPlayer[propName]] = propName, rtn), {});

export class AudioPlayer extends Observable implements IAudioPlayer {

    // Native variables
    private _android: android.media.MediaPlayer;
    get ios() { return undefined; }
    get android(): android.media.MediaPlayer { return this._android; }

    // Internal state
    private _internalState = InternalState.Idle;
    private _checkStates(state: InternalState[]) {
        return state.some(s => this._internalState == s);
    }

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
    loadAudio(uri: string, autoplay?: boolean) {

        // Store autoplay preference
        this._shouldAutoplay = !!autoplay;

        // If we already have a MediaPlayer, clean it up
        if (this.android) {
            this.unload();
        }

        // New MediaPlayer
        this._android = new android.media.MediaPlayer();
        this._internalState = InternalState.Idle;

        // Set to play through the media audio stream
        this._android.setAudioStreamType(android.media.AudioManager.STREAM_MUSIC);

        // Setup event handlers
        this._setupPlayerObservers();
        this._setupPositionObserver();

        // Set the media uri
        this._android.setDataSource(fixPath(uri));
        this._internalState = InternalState.Initialized;

        // Start preparing the media
        this._android.prepareAsync();
        this._internalState = InternalState.Preparing;
        this.setState(AudioPlayerState.Loading);
    };

    // Syncs the external state with the internal state. Used when seeking/buffering.
    private _syncExternalState() {
        switch (this._internalState) {
            case InternalState.Idle:
                this.setState(AudioPlayerState.Unloaded);
                break;
            case InternalState.Initialized:
                this.setState(AudioPlayerState.Unloaded);
                break;
            case InternalState.Preparing:
                this.setState(AudioPlayerState.Loading);
                break;
            case InternalState.Prepared:
                this.setState(AudioPlayerState.Loaded);
                break;
            case InternalState.Started:
                this.setState(AudioPlayerState.Playing);
                break;
            case InternalState.Paused:
                this.setState(AudioPlayerState.Paused);
                break;
            case InternalState.PlaybackCompleted:
                this.setState(AudioPlayerState.Loaded);
                break;
            case InternalState.Stopped:
                this.setState(AudioPlayerState.Unloaded);
                break;
            case InternalState.End:
                this.setState(AudioPlayerState.Unloaded);
                break;
            case InternalState.Error:
                this.setState(AudioPlayerState.Errored);
                break;
        }
    }

    // Setup event handlers
    private _setupPlayerObservers() {
        if (this.android) {

            // On error
            this._android.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener({
                onError: (player: android.media.MediaPlayer, error: number, extra: number) => {

                    // Update states
                    this._internalState = InternalState.Error;
                    this.setState(AudioPlayerState.Errored);
                    
                    console.log(`[MediaPlayer] Error: [${error}]${MEDIA_ERROR[error]} (${extra}`);

                    return true;

                }
            }));

            // On playback finished/complete
            this._android.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener({
                onCompletion: (player: android.media.MediaPlayer) => {

                    // Update states
                    this.stop();
                    this._internalState = InternalState.PlaybackCompleted;
                    this.setState(AudioPlayerState.Loaded);

                }
            }));

            // On media prepared to play
            this._android.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener({
                onPrepared: (player: android.media.MediaPlayer) => {

                    // Update states
                    this._internalState = InternalState.Prepared;
                    this.setState(AudioPlayerState.Loaded);

                    // Update duration
                    this.notifyPropertyChange("duration", this.getDuration());

                    // Autoplay if it was requested
                    if (this._shouldAutoplay) {
                        this._shouldAutoplay = false;
                        this.play();
                    }

                }
            }));

            // On info available
            this._android.setOnInfoListener(new android.media.MediaPlayer.OnInfoListener({
                onInfo: (player: android.media.MediaPlayer, what: number, extra: number) => {

                    switch (what) {
                        // If the media isn't seekable
                        case android.media.MediaPlayer.MEDIA_INFO_NOT_SEEKABLE:

                            // Disable seeking
                            this._isSeekable = false;
                            break;

                        // If the media is buffering
                        case android.media.MediaPlayer.MEDIA_INFO_BUFFERING_START:

                            // Set external state to loading (no internal state for buffering)
                            this.setState(AudioPlayerState.Loading);
                            break;

                        // If the media is done buffering
                        case android.media.MediaPlayer.MEDIA_INFO_BUFFERING_END:

                            // If it wasn't interupted, restore previous state
                            if (this._state == AudioPlayerState.Loading) {
                                this._syncExternalState();
                            }
                            break;

                    }

                    return true;

                }
            }));

            // On seek complete
            this._android.setOnSeekCompleteListener(new android.media.MediaPlayer.OnSeekCompleteListener({
                onSeekComplete: (player: android.media.MediaPlayer) => {

                    // If the seek wasn't interupted, restore previous state
                    if (this._state == AudioPlayerState.Loading) {
                        this._syncExternalState();
                    }

                }
            }));

            // On buffering percent updated
            this._android.setOnBufferingUpdateListener(new android.media.MediaPlayer.OnBufferingUpdateListener({
                onBufferingUpdate: (player: android.media.MediaPlayer, percent: number) => {
                    // Unused since it gives inconsistant results on different devices
                }
            }));
        }
    }

    // Play the loaded media
    play() {
        if (this._android) {

            // Start the MediaPlayer
            if (this._checkStates([
                InternalState.Prepared,
                InternalState.Started,
                InternalState.Paused,
                InternalState.PlaybackCompleted
            ])) {
                this._android.start();
                this._internalState = InternalState.Started;
                this.setState(AudioPlayerState.Playing);
            }
        }
    };

    // Pause the media
    pause() {
        if (this._android) {

            // Clear autoplay preferance
            this._shouldAutoplay = false;

            // Pause the MediaPlayer
            if (this._checkStates([
                InternalState.Started,
                InternalState.Paused,
            ])) {
                this._android.pause();
                this._internalState = InternalState.Paused;
                this.setState(AudioPlayerState.Paused);
            }
        }
    };

    // Resumes the media (same as play)
    resume() {
        this.play();
    };

    // Stops the media, but keeps it loaded and ready to play
    stop() {
        this.pause();
        this.seekTo(0);
    };

    // Unloads the media, stopping all playback and freeing up resources
    unload() {
        if (this._android) {

            // Reset item metadata
            this._externalMetadata = {};

            // Reset item seekability
            this._isSeekable = true;

            // Reset item volume
            this._lastKnownVolume = 1;

            // Teardown position updater
            this._teardownPositionObserver();

            // Stop the player
            this._android.stop();

            // Release the player
            this._android.release();

            // Drop the player reference
            this._android = null;

            // Update state
            this.setState(AudioPlayerState.Unloaded);
            this._internalState = InternalState.End;
        }
    };

    // Gets the duration in seconds
    getDuration(): number {
        return (this._android && this._checkStates([
            InternalState.Prepared,
            InternalState.Started,
            InternalState.Paused,
            InternalState.Stopped,
            InternalState.PlaybackCompleted
        ]))
            ? this._android.getDuration() / 1000 : -1;
    };

    // Gets the current play position in seconds
    public getPosition() {
        return (this._android && this._checkStates([
            InternalState.Idle,
            InternalState.Initialized,
            InternalState.Prepared,
            InternalState.Started,
            InternalState.Paused,
            InternalState.Stopped,
            InternalState.PlaybackCompleted
        ]))
            ? this._android.getCurrentPosition() / 1000 : -1;
    }

    // Sets the current play position in seconds
    private _isSeekable = true;
    setPosition(seconds: number) {
        if (this._android && this._isSeekable && this._checkStates([
            InternalState.Prepared,
            InternalState.Started,
            InternalState.Paused,
            InternalState.PlaybackCompleted
        ])) {
            this._android.seekTo(seconds * 1000);
            // No internal state for seeking
            this.setState(AudioPlayerState.Loading);
        }
    };
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

    // Setup/Teardown the position update timer
    private _positionObserver;
    private _setupPositionObserver() {
        if (this._android) {
            this._teardownPositionObserver();

            this._positionObserver = setInterval(() => {
                if (this._state == AudioPlayerState.Playing) {
                    this.notifyPropertyChange("position", this.getPosition());
                }
            }, this._positionUpdateFrequency * 1000);
        }
    }

    private _teardownPositionObserver() {
        if (this._android && this._positionObserver) {
            clearInterval(this._positionObserver);
            this._positionObserver = null;
        }
    }

    // Only supported on API level >= 23
    // TODO: Test for api level
    // Speed is a decimal number with 1.0 being normal speed
    public get canSetSpeed() {
        return false;
        // return apilevel >= 23
    }
    getSpeed(): number {
        return 1;
        // if apilevel >= 23
        //     return android.getPlaybackParams().speed
    };
    setSpeed(speed: number) {
        // if apilevel >= 23
        //     pars = android.getPlaybackParams()
        //     pars.speed = speed
        //     android.setPlaybackParams(pars)
    };

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

    // Android doesn't have a method to get volume, so we save the last set one.
    // Volume is a number between 0.0 and 1.0
    private _lastKnownVolume = 1;
    getVolume(): number {
        return this._lastKnownVolume;
    };
    setVolume(decimal: number) {
        if (this._android && this._checkStates([
            InternalState.Idle,
            InternalState.Initialized,
            InternalState.Prepared,
            InternalState.Started,
            InternalState.Paused,
            InternalState.Stopped,
            InternalState.PlaybackCompleted
        ])) {
            this._android.setVolume(decimal, decimal);
            this._lastKnownVolume = decimal;
        }
    };

    // Store the external metadata so we can merge it with metadata from the media
    // External metadata overrides internal metadata
    // TODO: lookup and merge internal metadata
    private _externalMetadata: Object = {};
    getCombinedMetadata(): Object {
        return this._externalMetadata;
    };
    public setExternalMetadata(metadata: Object) {
        this._externalMetadata = metadata;
        this.notifyPropertyChange("metadata", this.getCombinedMetadata());
    }
}