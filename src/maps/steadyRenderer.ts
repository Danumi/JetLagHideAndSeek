import * as L from "leaflet";

/*
 * Leaflet draws shapes only a little beyond the screen and draws them again
 * once the map stops. While the map was dragged, the grey area ended at the
 * edge of what had been drawn: a light strip at the edge of the screen that
 * turned grey once the map stopped.
 */

/** Shapes are drawn this far beyond the screen, in screen sizes. */
const STEADY_PADDING = 0.5;

const SteadySVG = (L.SVG as any).extend({
    getEvents(this: any) {
        return {
            ...L.SVG.prototype.getEvents!.call(this),
            move: this._keepDrawn,
        };
    },

    /** Draws again while the map moves, once the screen gets past the edge. */
    _keepDrawn(this: any) {
        const map: L.Map | undefined = this._map;
        // Not while zooming: the shapes are worked out for the zoom they had
        if (!map || !this._bounds || map.getZoom() !== this._zoom) return;
        const view = L.bounds(
            map.containerPointToLayerPoint([0, 0]),
            map.containerPointToLayerPoint(map.getSize()),
        );
        if (!this._bounds.contains(view)) this._update();
    },
});

/**
 * An SVG renderer that keeps its shapes drawn while the map moves. Only for
 * a few large shapes like the grey areas: the lines on the map have many
 * points and are drawn once the map stops, as before.
 */
export const steadyRenderer = (pane?: string): L.Renderer =>
    new SteadySVG({ padding: STEADY_PADDING, ...(pane && { pane }) });
