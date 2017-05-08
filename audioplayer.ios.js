"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var audioplayer_common_1 = require("./audioplayer.common");
exports.AudioPlayerState = audioplayer_common_1.AudioPlayerState;
var observable_1 = require("data/observable");
var AudioPlayerKeyPathObserver = (function (_super) {
    __extends(AudioPlayerKeyPathObserver, _super);
    function AudioPlayerKeyPathObserver() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AudioPlayerKeyPathObserver.initWithOwner = function (owner) {
        var handler = AudioPlayerKeyPathObserver.new();
        handler._owner = owner;
        return handler;
    };
    AudioPlayerKeyPathObserver.prototype.observeValueForKeyPathOfObjectChangeContext = function (keypath, source, change, context) {
        var owner = this._owner.get();
        if (owner) {
            owner.onKeyPathEvent(keypath, source, change, context);
        }
    };
    return AudioPlayerKeyPathObserver;
}(NSObject));
var AudioPlayer = (function (_super) {
    __extends(AudioPlayer, _super);
    function AudioPlayer() {
        var _this = _super.call(this) || this;
        _this._state = audioplayer_common_1.AudioPlayerState.Unloaded;
        _this._shouldAutoplay = false;
        _this._isObservingItem = false;
        _this._waitingForPlay = false;
        _this._positionUpdateFrequency = 1;
        _this._currentLoop = 0;
        _this._loopGoal = 0;
        _this._externalMetadata = {};
        _this._keyPathObserver = AudioPlayerKeyPathObserver.initWithOwner(new WeakRef(_this));
        return _this;
    }
    Object.defineProperty(AudioPlayer.prototype, "ios", {
        get: function () { return this._ios; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "android", {
        get: function () { return undefined; },
        enumerable: true,
        configurable: true
    });
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
        if (this._state == audioplayer_common_1.AudioPlayerState.Errored) {
            this.unload();
        }
        if (!this._ios) {
            this._ios = AVPlayer.alloc().initWithURL(NSURL.URLWithString(audioplayer_common_1.fixPath(uri)));
            this._setupItemObservers();
            this._setupPositionObserver();
        }
        else {
            this._ios.pause();
            this._teardownItemObservers();
            this._externalMetadata = {};
            this._ios.replaceCurrentItemWithPlayerItem(AVPlayerItem.alloc().initWithURL(NSURL.URLWithString(audioplayer_common_1.fixPath(uri))));
            this._setupItemObservers();
        }
        this._setupAudioSession();
        this.setState(audioplayer_common_1.AudioPlayerState.Loading);
    };
    AudioPlayer.prototype._setupItemObservers = function () {
        if (this._ios && this._ios.currentItem) {
            if (this._isObservingItem) {
                this._teardownItemObservers();
            }
            this._ios.currentItem.addObserverForKeyPathOptionsContext(this._keyPathObserver, "status", 4, null);
            this._ios.currentItem.addObserverForKeyPathOptionsContext(this._keyPathObserver, "duration", 4, null);
            this._ios.currentItem.addObserverForKeyPathOptionsContext(this._keyPathObserver, "timeControlStatus", 4, null);
            this._ios.currentItem.asset.addObserverForKeyPathOptionsContext(this._keyPathObserver, "metadata", 4, null);
            this._isObservingItem = true;
        }
    };
    AudioPlayer.prototype._teardownItemObservers = function () {
        if (this._ios && this._ios.currentItem && this._isObservingItem) {
            this._ios.currentItem.removeObserverForKeyPathContext(this._keyPathObserver, "status", null);
            this._ios.currentItem.removeObserverForKeyPathContext(this._keyPathObserver, "duration", null);
            this._ios.currentItem.removeObserverForKeyPathContext(this._keyPathObserver, "timeControlStatus", null);
            this._ios.currentItem.asset.removeObserverForKeyPathContext(this._keyPathObserver, "metadata", null);
            this._isObservingItem = false;
        }
    };
    AudioPlayer.prototype.play = function () {
        if (this._ios) {
            this._ios.play();
            this.setState(audioplayer_common_1.AudioPlayerState.Loading);
            this._waitingForPlay = true;
        }
    };
    AudioPlayer.prototype.pause = function () {
        if (this._ios) {
            this._shouldAutoplay = false;
            this._ios.pause();
            this.setState(audioplayer_common_1.AudioPlayerState.Paused);
        }
    };
    AudioPlayer.prototype.resume = function () {
        this.play();
    };
    AudioPlayer.prototype.stop = function () {
        this.pause();
        this.seekTo(0);
    };
    AudioPlayer.prototype.unload = function () {
        if (this._ios) {
            this._ios.pause();
            this._externalMetadata = {};
            this._teardownItemObservers();
            this._teardownPositionObserver();
            this._ios.replaceCurrentItemWithPlayerItem(null);
            this._ios = null;
            this._teardownAudioSession();
            this.setState(audioplayer_common_1.AudioPlayerState.Unloaded);
        }
    };
    AudioPlayer.prototype.getDuration = function () {
        return (this._ios && this._ios.currentItem) ? CMTimeGetSeconds(this._ios.currentItem.duration) : -1;
    };
    AudioPlayer.prototype.getPosition = function () {
        return this._ios ? CMTimeGetSeconds(this._ios.currentTime()) : -1;
    };
    AudioPlayer.prototype.setPosition = function (seconds) {
        if (this._ios) {
            this._ios.seekToTime(CMTimeMakeWithSeconds(Math.round(seconds), 1));
        }
    };
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
        if (this._ios) {
            this._teardownPositionObserver();
            this._positionObserver = this._ios.addPeriodicTimeObserverForIntervalQueueUsingBlock(CMTimeMakeWithSeconds(this._positionUpdateFrequency, 1), null, function (positionCMTime) {
                if (_this._waitingForPlay) {
                    _this.setState(audioplayer_common_1.AudioPlayerState.Playing);
                    _this._waitingForPlay = false;
                }
                _this.notifyPropertyChange("position", CMTimeGetSeconds(positionCMTime));
            });
        }
    };
    AudioPlayer.prototype._teardownPositionObserver = function () {
        if (this._ios && this._positionObserver) {
            this._ios.removeTimeObserver(this._positionObserver);
            this._positionObserver = null;
        }
    };
    Object.defineProperty(AudioPlayer.prototype, "canSetSpeed", {
        get: function () {
            return true;
        },
        enumerable: true,
        configurable: true
    });
    AudioPlayer.prototype.getSpeed = function () {
        return this._ios ? this._ios.rate : 0;
    };
    AudioPlayer.prototype.setSpeed = function (speed) {
        if (this._ios) {
            this._ios.rate = speed;
        }
    };
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
        return this._ios ? this._ios.volume : -1;
    };
    AudioPlayer.prototype.setVolume = function (decimalVolume) {
        if (this._ios) {
            this._ios.volume = decimalVolume;
        }
    };
    AudioPlayer.prototype.onKeyPathEvent = function (keypath, source, change, context) {
        if (keypath == "status") {
            if (this._ios.currentItem.status == 1) {
                if (this.state == audioplayer_common_1.AudioPlayerState.Loading) {
                    this.setState(audioplayer_common_1.AudioPlayerState.Loaded);
                    if (this._shouldAutoplay) {
                        this.play();
                    }
                }
            }
            else if (this._ios.currentItem.status == 2) {
                this.setState(audioplayer_common_1.AudioPlayerState.Errored);
                var err = this._ios.currentItem.error;
                console.log("[AVPlayer] Error: [" + err.domain + ":" + err.code + "] \"" + err.localizedDescription + "\": \"" + err.localizedFailureReason + "\"");
            }
        }
        if (keypath == "timeControlStatus") {
            switch (this._ios.timeControlStatus) {
                case 0:
                    this.setState(audioplayer_common_1.AudioPlayerState.Paused);
                    break;
                case 2:
                    this.setState(audioplayer_common_1.AudioPlayerState.Playing);
                    break;
                case 1:
                    this.setState(audioplayer_common_1.AudioPlayerState.Loading);
                    break;
            }
        }
        if (keypath == "duration") {
            this.notifyPropertyChange("duration", CMTimeGetSeconds(this._ios.currentItem.duration));
        }
        if (keypath == "metadata") {
            this.notifyPropertyChange("metadata", this.getCombinedMetadata());
        }
    };
    AudioPlayer.prototype.getCombinedMetadata = function () {
        var metadata = {};
        if (this._ios && this._ios.currentItem && this._ios.currentItem.asset) {
            var internalMetadata = this._ios.currentItem.asset.metadata;
            if (internalMetadata) {
                var internalMetadataCount = internalMetadata.count;
                for (var i = 0; i < internalMetadataCount; ++i) {
                    var metaItem = internalMetadata.objectAtIndex(i);
                    metadata[metaItem.commonKey ? metaItem.commonKey : metaItem.key] = metaItem.stringValue || metaItem.dateValue || metaItem.numberValue;
                }
            }
        }
        for (var extMetaItem in this._externalMetadata) {
            metadata[extMetaItem] = this._externalMetadata[extMetaItem];
        }
        return metadata;
    };
    AudioPlayer.prototype.setExternalMetadata = function (metadata) {
        this._externalMetadata = metadata;
        this.notifyPropertyChange("metadata", this.getCombinedMetadata());
    };
    AudioPlayer.prototype._setupAudioSession = function () {
        var avSession = AVAudioSession.sharedInstance();
        avSession.setCategoryError(AVAudioSessionCategoryPlayback);
        avSession.setActiveError(true);
    };
    AudioPlayer.prototype._teardownAudioSession = function () {
        var avSession = AVAudioSession.sharedInstance();
        avSession.setActiveError(false);
    };
    return AudioPlayer;
}(observable_1.Observable));
exports.AudioPlayer = AudioPlayer;
