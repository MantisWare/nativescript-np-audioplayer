import { Observable } from "data/observable";

import fs = require('file-system');

export function fixPath(pathStr: string) {
    pathStr = pathStr.trim();
    return pathStr.indexOf("~/") === 0 ? fs.path.join(fs.knownFolders.currentApp().path, pathStr.substr(2)) : pathStr;
}

export enum AudioPlayerState {
    Unloaded,
    Loading,
    Loaded,
    Playing,
    Paused,
    Errored
}

export { IAudioPlayer } from './audioplayer';
