import { Observable } from "data/observable";

import { AudioPlayerState } from './audioplayer.common';

export { AudioPlayerState }

export class AudioPlayer extends Observable {

    /**
    * Gets the native [MediaPlayer](https://developer.android.com/reference/android/media/MediaPlayer.html). Valid only when running on Android OS. If the state is unloaded this will be null.
    */
    android: any /* android.media.MediaPlayer */;

    /**
     * Gets the native [AVPlayer](https://developer.apple.com/reference/avfoundation/avplayer). Valid only when running on iOS. If the state is unloaded this will be null.
     * @type {*}
     * @memberOf AudioPlayer
     */
    ios: any /* AVPlayer */;

    /**
     * The current state of the AudioPlayer
     * @type {AudioPlayerState}
     * @memberOf AudioPlayer
     */
    state: AudioPlayerState;

    /**
     * Loads and prepares audio from the given URI. If the player is already playing it will be stopped.
     * @param {string} uri The source URI for the audio. Can be a local/remote file or stream.
     * @param {boolean} [autoplay] Whether or not to automatticaly start playing the audio once it's loaded.
     * @memberOf AudioPlayer
     */
    loadAudio(uri: string, autoplay?: boolean);
    play();
    pause();
    resume();
    stop();
    unload();
    getDuration(): number;
    getPosition();
    setPosition(seconds: number);
    seekTo(seconds: number);
    getPositionUpdateFrequency(): number;
    setPositionUpdateFrequency(seconds: number);
    canSetSpeed: boolean;
    getSpeed(): number;
    setSpeed(speed: number);
    getLoopCount(): number;
    setLoopCount(count: number);
    getLoopCountGoal(): number;
    setLoopCountGoal(count: number);
    getVolume(): number;
    setVolume(decimal: number);
    getCombinedMetadata(): Object;
    setExternalMetadata(data: Object);
}

export interface IAudioPlayer extends AudioPlayer { }
