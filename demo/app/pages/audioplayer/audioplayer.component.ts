import { Component, OnInit, ChangeDetectorRef, OnDestroy } from "@angular/core";

import { SeekEventData, SeekEventAction } from "../../shared/seekbar.component";
import { EventData, PropertyChangeData } from "data/observable";


import { AudioPlayer, AudioPlayerState } from "nativescript-np-audioplayer";

import { AudioPlayerService } from "../../shared/audioplayer.service";

class MaterialIcons {
    static Play = String.fromCharCode(0xF40A);
    static Pause = String.fromCharCode(0xF3E4);
    static Loading = String.fromCharCode(0xF06A);
    static Error = String.fromCharCode(0xF205);
}

function secToTimestamp(sec: number) {
    sec = Math.round(sec);
    return (sec < 0 || isNaN(sec)) ? "-:--" : (Math.floor(sec / 60) + ":" + `0${sec % 60}`.slice(-2));
}

function calcPercent(part: number, total: number) {
    return (total > 0 && part <= total ? part / total : 1) * 100;
}

@Component({
    selector: "ns-audioplayer",
    moduleId: module.id,
    templateUrl: "./audioplayer.component.html",
    styleUrls: ["./audioplayer.component.css"]
})
export class AudioPlayerComponent implements OnInit, OnDestroy {

    private playerTitle = "Unknown";
    private playerSubtitle = "Unknown";
    private playerImageURI;
    private playerImageCache;
    private playerPlayButtonText = MaterialIcons.Play;
    private playerTimelineProgress = 0;
    private playerTimecodeText = "-:-- / -:--";
    private playerTimecodeWidth = 60;
    private _playerPropertyChangedListener;

    constructor(private _changeDetectorRef: ChangeDetectorRef, private _audioPlayerService: AudioPlayerService) { }

    ngOnInit(): void {

        this.onDurationUpdate(this._audioPlayerService.getDuration());
        this.onPositionUpdate(this._audioPlayerService.getPosition());
        this.onStateUpdate(this._audioPlayerService.state);
        this.onMetadataUpdate(this._audioPlayerService.getCombinedMetadata());

        this._audioPlayerService.on("propertyChange", this._playerPropertyChangedListener = (data: PropertyChangeData) => {
            switch (data.propertyName) {
                case "state":
                    this.onStateUpdate(data.value)
                    break;
                case "position":
                    this.onPositionUpdate(data.value)
                    break;
                case "duration":
                    this.onDurationUpdate(data.value);
                    break;
                case "metadata":
                    this.onMetadataUpdate(data.value);
                    break;
                default:
                    break;
            }
        });
    }

    ngOnDestroy() {
        this._audioPlayerService.off("propertyChange", this._playerPropertyChangedListener);
        if(this._audioPlayerService.state == AudioPlayerState.Paused) {
            this._audioPlayerService.unload();
        }
    }

    private durationSec = 0;
    private durationText = "-:--";

    private onDurationUpdate(durationSec: number) {
        this.durationSec = durationSec;
        this.durationText = secToTimestamp(durationSec);
        this.playerTimecodeWidth = Math.round(((this.durationText.length * 2) + 3) * 6.1);
        this.updateTimelineProgress();
    }

    private positionSec = 0;
    private positionText = "-:--";

    private onPositionUpdate(positionSec: number) {
        this.positionSec = positionSec;
        this.positionText = secToTimestamp(this.positionSec);
        this.updateTimelineProgress();
    }

    private isSeeking = false;
    private seekText = "-:--";

    onSeekEvent(event: SeekEventData) {
        switch (event.action) {
            case SeekEventAction.Start:
                this.isSeeking = true;
                break;
            case SeekEventAction.Update:
                this.seekText = secToTimestamp((event.value / 100) * this.durationSec);
                this.updateTimelineProgress();
                break;
            case SeekEventAction.End:
                this.isSeeking = false;
                this._audioPlayerService.seekTo(this.durationSec * (event.value / 100));
                break;
            case SeekEventAction.Cancel:
            default:
                this.isSeeking = false;
                this.updateTimelineProgress();
                break;
        }
    }

    private onStateUpdate(state: AudioPlayerState) {
        switch (state) {
            case AudioPlayerState.Unloaded:
            case AudioPlayerState.Paused:
            case AudioPlayerState.Loaded:
                this.playerPlayButtonText = MaterialIcons.Play;
                break;
            case AudioPlayerState.Loading:
                this.playerPlayButtonText = MaterialIcons.Loading;
                break;
            case AudioPlayerState.Errored:
                this.playerPlayButtonText = MaterialIcons.Error;
                break;
            case AudioPlayerState.Playing:
                this.playerPlayButtonText = MaterialIcons.Pause;
                break;
            default:
                break;
        }
        this._changeDetectorRef.detectChanges();
    }

    private onMetadataUpdate(data) {
        this.playerTitle = data.title || "Unknown";
        this.playerSubtitle = data.subtitle || "Unknown";
    }

    public updateTimelineProgress() {
        if (this.isSeeking) {
            this.playerTimecodeText = `${this.seekText} / ${this.durationText}`;
        } else {
            this.playerTimelineProgress = calcPercent(this.positionSec, this.durationSec);
            this.playerTimecodeText = `${this.positionText} / ${this.durationText}`;
        }
        this._changeDetectorRef.detectChanges();
    }

    public onPlayButtonClick() {
        if (this._audioPlayerService.state != AudioPlayerState.Playing) {
            if (this._audioPlayerService.state == AudioPlayerState.Paused) {
                this._audioPlayerService.resume();
            }
            else if (this._audioPlayerService.state == AudioPlayerState.Loading) {
                this._audioPlayerService.pause();
            }
            else {
                this._audioPlayerService.loadAudio("https://newpointe.blob.core.windows.net/newpointe-webassets/podcasts/8e13f2f2527b458ab729a68d4b58e1a8_Anger%20Epidemic%20Wk%202.mp3", true);
                this._audioPlayerService.setExternalMetadata({
                    title: "The Anger Epidemic Week 2",
                    subtitle: "Dwight Mason"
                });
            }
        }
        else {
            this._audioPlayerService.pause();
        }
    }
}
