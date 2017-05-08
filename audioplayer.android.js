"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var audioplayer_common_1 = require("./audioplayer.common");
exports.AudioPlayerState = audioplayer_common_1.AudioPlayerState;
var observable_1 = require("data/observable");
var InternalState;
(function (InternalState) {
    InternalState[InternalState["Idle"] = 0] = "Idle";
    InternalState[InternalState["Initialized"] = 1] = "Initialized";
    InternalState[InternalState["Preparing"] = 2] = "Preparing";
    InternalState[InternalState["Prepared"] = 3] = "Prepared";
    InternalState[InternalState["Started"] = 4] = "Started";
    InternalState[InternalState["Paused"] = 5] = "Paused";
    InternalState[InternalState["PlaybackCompleted"] = 6] = "PlaybackCompleted";
    InternalState[InternalState["Stopped"] = 7] = "Stopped";
    InternalState[InternalState["End"] = 8] = "End";
    InternalState[InternalState["Error"] = 9] = "Error";
})(InternalState || (InternalState = {}));
var MEDIA_INFO = Object.keys(android.media.MediaPlayer).filter(function (p) { return p.startsWith("MEDIA_INFO_"); }).reduce(function (rtn, propName) { return (rtn[rtn[propName] = android.media.MediaPlayer[propName]] = propName, rtn); }, {});
var MEDIA_ERROR = Object.keys(android.media.MediaPlayer).filter(function (p) { return p.startsWith("MEDIA_ERROR_"); }).reduce(function (rtn, propName) { return (rtn[rtn[propName] = android.media.MediaPlayer[propName]] = propName, rtn); }, {});
var AudioPlayer = (function (_super) {
    __extends(AudioPlayer, _super);
    function AudioPlayer() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._internalState = InternalState.Idle;
        _this._state = audioplayer_common_1.AudioPlayerState.Unloaded;
        _this._shouldAutoplay = false;
        _this._isSeekable = true;
        _this._positionUpdateFrequency = 1;
        _this._currentLoop = 0;
        _this._loopGoal = 0;
        _this._lastKnownVolume = 1;
        _this._externalMetadata = {};
        return _this;
    }
    Object.defineProperty(AudioPlayer.prototype, "ios", {
        get: function () { return undefined; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "android", {
        get: function () { return this._android; },
        enumerable: true,
        configurable: true
    });
    AudioPlayer.prototype._checkStates = function (state) {
        var _this = this;
        return state.some(function (s) { return _this._internalState == s; });
    };
    Object.defineProperty(AudioPlayer.prototype, "state", {
        get: function () { return this._state; },
        enumerable: true,
        configurable: true
    });
    AudioPlayer.prototype.setState = function (newState) {
        this._state = newState;
        this.notifyPropertyChange("state", newState);
    };
    AudioPlayer.prototype.loadAudio = function (uri, autoplay) {
        this._shouldAutoplay = !!autoplay;
        if (this.android) {
            this.unload();
        }
        this._android = new android.media.MediaPlayer();
        this._internalState = InternalState.Idle;
        this._android.setAudioStreamType(android.media.AudioManager.STREAM_MUSIC);
        this._setupPlayerObservers();
        this._setupPositionObserver();
        this._android.setDataSource(audioplayer_common_1.fixPath(uri));
        this._internalState = InternalState.Initialized;
        this._android.prepareAsync();
        this._internalState = InternalState.Preparing;
        this.setState(audioplayer_common_1.AudioPlayerState.Loading);
    };
    ;
    AudioPlayer.prototype._syncExternalState = function () {
        switch (this._internalState) {
            case InternalState.Idle:
                this.setState(audioplayer_common_1.AudioPlayerState.Unloaded);
                break;
            case InternalState.Initialized:
                this.setState(audioplayer_common_1.AudioPlayerState.Unloaded);
                break;
            case InternalState.Preparing:
                this.setState(audioplayer_common_1.AudioPlayerState.Loading);
                break;
            case InternalState.Prepared:
                this.setState(audioplayer_common_1.AudioPlayerState.Loaded);
                break;
            case InternalState.Started:
                this.setState(audioplayer_common_1.AudioPlayerState.Playing);
                break;
            case InternalState.Paused:
                this.setState(audioplayer_common_1.AudioPlayerState.Paused);
                break;
            case InternalState.PlaybackCompleted:
                this.setState(audioplayer_common_1.AudioPlayerState.Loaded);
                break;
            case InternalState.Stopped:
                this.setState(audioplayer_common_1.AudioPlayerState.Unloaded);
                break;
            case InternalState.End:
                this.setState(audioplayer_common_1.AudioPlayerState.Unloaded);
                break;
            case InternalState.Error:
                this.setState(audioplayer_common_1.AudioPlayerState.Errored);
                break;
        }
    };
    AudioPlayer.prototype._setupPlayerObservers = function () {
        var _this = this;
        if (this.android) {
            this._android.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener({
                onError: function (player, error, extra) {
                    _this._internalState = InternalState.Error;
                    _this.setState(audioplayer_common_1.AudioPlayerState.Errored);
                    console.log("[MediaPlayer] Error: [" + error + "]" + MEDIA_ERROR[error] + " (" + extra);
                    return true;
                }
            }));
            this._android.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener({
                onCompletion: function (player) {
                    _this.stop();
                    _this._internalState = InternalState.PlaybackCompleted;
                    _this.setState(audioplayer_common_1.AudioPlayerState.Loaded);
                }
            }));
            this._android.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener({
                onPrepared: function (player) {
                    _this._internalState = InternalState.Prepared;
                    _this.setState(audioplayer_common_1.AudioPlayerState.Loaded);
                    _this.notifyPropertyChange("duration", _this.getDuration());
                    if (_this._shouldAutoplay) {
                        _this._shouldAutoplay = false;
                        _this.play();
                    }
                }
            }));
            this._android.setOnInfoListener(new android.media.MediaPlayer.OnInfoListener({
                onInfo: function (player, what, extra) {
                    switch (what) {
                        case android.media.MediaPlayer.MEDIA_INFO_NOT_SEEKABLE:
                            _this._isSeekable = false;
                            break;
                        case android.media.MediaPlayer.MEDIA_INFO_BUFFERING_START:
                            _this.setState(audioplayer_common_1.AudioPlayerState.Loading);
                            break;
                        case android.media.MediaPlayer.MEDIA_INFO_BUFFERING_END:
                            if (_this._state == audioplayer_common_1.AudioPlayerState.Loading) {
                                _this._syncExternalState();
                            }
                            break;
                    }
                    return true;
                }
            }));
            this._android.setOnSeekCompleteListener(new android.media.MediaPlayer.OnSeekCompleteListener({
                onSeekComplete: function (player) {
                    if (_this._state == audioplayer_common_1.AudioPlayerState.Loading) {
                        _this._syncExternalState();
                    }
                }
            }));
            this._android.setOnBufferingUpdateListener(new android.media.MediaPlayer.OnBufferingUpdateListener({
                onBufferingUpdate: function (player, percent) {
                }
            }));
        }
    };
    AudioPlayer.prototype.play = function () {
        if (this._android) {
            if (this._checkStates([
                InternalState.Prepared,
                InternalState.Started,
                InternalState.Paused,
                InternalState.PlaybackCompleted
            ])) {
                this._android.start();
                this._internalState = InternalState.Started;
                this.setState(audioplayer_common_1.AudioPlayerState.Playing);
            }
        }
    };
    ;
    AudioPlayer.prototype.pause = function () {
        if (this._android) {
            this._shouldAutoplay = false;
            if (this._checkStates([
                InternalState.Started,
                InternalState.Paused,
            ])) {
                this._android.pause();
                this._internalState = InternalState.Paused;
                this.setState(audioplayer_common_1.AudioPlayerState.Paused);
            }
        }
    };
    ;
    AudioPlayer.prototype.resume = function () {
        this.play();
    };
    ;
    AudioPlayer.prototype.stop = function () {
        this.pause();
        this.seekTo(0);
    };
    ;
    AudioPlayer.prototype.unload = function () {
        if (this._android) {
            this._externalMetadata = {};
            this._isSeekable = true;
            this._lastKnownVolume = 1;
            this._teardownPositionObserver();
            this._android.stop();
            this._android.release();
            this._android = null;
            this.setState(audioplayer_common_1.AudioPlayerState.Unloaded);
            this._internalState = InternalState.End;
        }
    };
    ;
    AudioPlayer.prototype.getDuration = function () {
        return (this._android && this._checkStates([
            InternalState.Prepared,
            InternalState.Started,
            InternalState.Paused,
            InternalState.Stopped,
            InternalState.PlaybackCompleted
        ]))
            ? this._android.getDuration() / 1000 : -1;
    };
    ;
    AudioPlayer.prototype.getPosition = function () {
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
    };
    AudioPlayer.prototype.setPosition = function (seconds) {
        if (this._android && this._isSeekable && this._checkStates([
            InternalState.Prepared,
            InternalState.Started,
            InternalState.Paused,
            InternalState.PlaybackCompleted
        ])) {
            this._android.seekTo(seconds * 1000);
            this.setState(audioplayer_common_1.AudioPlayerState.Loading);
        }
    };
    ;
    AudioPlayer.prototype.seekTo = function (seconds) {
        this.setPosition(seconds);
    };
    AudioPlayer.prototype.getPositionUpdateFrequency = function () {
        return this._positionUpdateFrequency;
    };
    AudioPlayer.prototype.setPositionUpdateFrequency = function (seconds) {
        this._positionUpdateFrequency = seconds;
        this._setupPositionObserver();
    };
    AudioPlayer.prototype._setupPositionObserver = function () {
        var _this = this;
        if (this._android) {
            this._teardownPositionObserver();
            this._positionObserver = setInterval(function () {
                if (_this._state == audioplayer_common_1.AudioPlayerState.Playing) {
                    _this.notifyPropertyChange("position", _this.getPosition());
                }
            }, this._positionUpdateFrequency * 1000);
        }
    };
    AudioPlayer.prototype._teardownPositionObserver = function () {
        if (this._android && this._positionObserver) {
            clearInterval(this._positionObserver);
            this._positionObserver = null;
        }
    };
    Object.defineProperty(AudioPlayer.prototype, "canSetSpeed", {
        get: function () {
            return false;
        },
        enumerable: true,
        configurable: true
    });
    AudioPlayer.prototype.getSpeed = function () {
        return 1;
    };
    ;
    AudioPlayer.prototype.setSpeed = function (speed) {
    };
    ;
    AudioPlayer.prototype.getLoopCount = function () {
        return this._currentLoop;
    };
    AudioPlayer.prototype.setLoopCount = function (count) {
        this._currentLoop = count;
    };
    AudioPlayer.prototype.getLoopCountGoal = function () {
        return this._loopGoal;
    };
    AudioPlayer.prototype.setLoopCountGoal = function (count) {
        this._loopGoal = count;
    };
    AudioPlayer.prototype.getVolume = function () {
        return this._lastKnownVolume;
    };
    ;
    AudioPlayer.prototype.setVolume = function (decimal) {
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
    ;
    AudioPlayer.prototype.getCombinedMetadata = function () {
        return this._externalMetadata;
    };
    ;
    AudioPlayer.prototype.setExternalMetadata = function (metadata) {
        this._externalMetadata = metadata;
        this.notifyPropertyChange("metadata", this.getCombinedMetadata());
    };
    return AudioPlayer;
}(observable_1.Observable));
exports.AudioPlayer = AudioPlayer;
