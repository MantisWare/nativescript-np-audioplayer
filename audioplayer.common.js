"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("file-system");
function fixPath(pathStr) {
    pathStr = pathStr.trim();
    return pathStr.indexOf("~/") === 0 ? fs.path.join(fs.knownFolders.currentApp().path, pathStr.substr(2)) : pathStr;
}
exports.fixPath = fixPath;
var AudioPlayerState;
(function (AudioPlayerState) {
    AudioPlayerState[AudioPlayerState["Unloaded"] = 0] = "Unloaded";
    AudioPlayerState[AudioPlayerState["Loading"] = 1] = "Loading";
    AudioPlayerState[AudioPlayerState["Loaded"] = 2] = "Loaded";
    AudioPlayerState[AudioPlayerState["Playing"] = 3] = "Playing";
    AudioPlayerState[AudioPlayerState["Paused"] = 4] = "Paused";
    AudioPlayerState[AudioPlayerState["Errored"] = 5] = "Errored";
})(AudioPlayerState = exports.AudioPlayerState || (exports.AudioPlayerState = {}));
