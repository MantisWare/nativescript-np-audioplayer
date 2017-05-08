import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { NativeScriptModule } from "nativescript-angular/nativescript.module";
import { AppRoutingModule } from "./app.routing";
import { AppComponent } from "./app.component";

import { AudioPlayerComponent } from "./pages/audioplayer/audioplayer.component";
import { HomeComponent } from "./pages/home/home.component";
import { SeekbarComponent } from "./shared/seekbar.component";

import { AudioPlayerService } from "./shared/audioplayer.service";

@NgModule({
    bootstrap: [
        AppComponent
    ],
    imports: [
        NativeScriptModule,
        AppRoutingModule
    ],
    declarations: [
        AppComponent,
        AudioPlayerComponent,
        HomeComponent,
        SeekbarComponent
    ],
    providers: [
        AudioPlayerService
    ],
    schemas: [
        NO_ERRORS_SCHEMA
    ]
})
export class AppModule { }
