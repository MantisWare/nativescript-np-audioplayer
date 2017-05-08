import { Component, OnInit, ChangeDetectorRef, OnDestroy } from "@angular/core";
import { RouterExtensions } from "nativescript-angular/router";

@Component({
    selector: "np-home",
    moduleId: module.id,
    template: '<Label text="Go to player!" (tap)="linkTap()"></Label>'
})
export class HomeComponent {


    constructor(private _routerExtentions: RouterExtensions) { }

    linkTap() {
        this._routerExtentions.navigate(["/audioplayer"],
            {
                transition: {
                    name: "slide",
                    duration: 300,
                    curve: "linear"
                }
            });
    }
}