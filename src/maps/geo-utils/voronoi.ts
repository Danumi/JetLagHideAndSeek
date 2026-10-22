import * as turf from "@turf/turf";
import { geoMercator } from "d3-geo";
// @ts-expect-error No type declaration
import { geoProject, geoStitch } from "d3-geo-projection";
// @ts-expect-error No type declaration
import { geoVoronoi } from "d3-geo-voronoi";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";

const scaleReference = turf.toMercator(turf.point([180, 90])); // I thought this would yield the same as turf.earthRadius * Math.pi, but it's slightly larger

export const geoSpatialVoronoi = (
    points: FeatureCollection<Point>,
): FeatureCollection<Polygon | MultiPolygon> => {
    const voronoi = geoVoronoi()(points).polygons();
    const projected = geoProject(
        geoStitch(voronoi),
        geoMercator().translate([0, 0]).precision(0.005),
    );

    const ratio = scaleReference.geometry.coordinates[0] / 480.5; // 961 is the default scale for some reason

    turf.coordEach(projected, (coord) => {
        coord[0] = coord[0] * ratio;
        coord[1] = coord[1] * -ratio; // y-coordinates are flipped
    });

    return turf.toWgs84(projected);
};

const HALF_EARTH_SQUARE_METERS = 2.5e14;

/**
 * The Voronoi cell of the place nearest to `point`: the area whose nearest
 * place is the same as at `point`. Places very close to each other can come
 * out of the spherical Voronoi as inverted cells that cover the whole globe,
 * so those fall back to a planar Voronoi in Web Mercator, which is accurate
 * enough at city scale.
 */
export const nearestVoronoiCell = (
    points: Feature<Point>[],
    point: Feature<Point>,
): Feature<Polygon | MultiPolygon> | undefined => {
    // Duplicate places have no cell of their own
    const unique = [
        ...new Map(
            points.map((p) => [p.geometry.coordinates.join(","), p]),
        ).values(),
    ];
    const index = turf.nearestPoint(point, turf.featureCollection(unique))
        .properties.featureIndex;

    const cell = geoSpatialVoronoi(turf.featureCollection(unique)).features[
        index
    ];
    if (
        cell &&
        turf.booleanPointInPolygon(point, cell) &&
        turf.area(cell) < HALF_EARTH_SQUARE_METERS
    ) {
        return cell;
    }

    const projected = turf.featureCollection(
        unique.map((p) => turf.toMercator(p)),
    );
    const [minX, minY, maxX, maxY] = turf.bbox(
        turf.featureCollection([...projected.features, turf.toMercator(point)]),
    );
    const margin = Math.max(maxX - minX, maxY - minY, 1000);
    const planar = turf.voronoi(projected, {
        bbox: [minX - margin, minY - margin, maxX + margin, maxY + margin],
    }).features[index];
    return planar ? turf.toWgs84(planar) : undefined;
};
