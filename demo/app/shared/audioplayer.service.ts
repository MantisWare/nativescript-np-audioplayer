import { Injectable } from "@angular/core";
import { AudioPlayer } from 'nativescript-np-audioplayer';

@Injectable()
export class AudioPlayerService extends AudioPlayer {
    constructor(){
        super();
    }
 }
