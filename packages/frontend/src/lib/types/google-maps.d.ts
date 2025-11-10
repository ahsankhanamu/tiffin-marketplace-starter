declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options?: MapOptions);
      setCenter(latlng: LatLng | LatLngLiteral): void;
      addListener(eventName: string, handler: Function): MapsEventListener;
      fitBounds(bounds: LatLngBounds, padding?: number | { top?: number; right?: number; bottom?: number; left?: number }): void;
    }

    class Marker {
      constructor(options?: MarkerOptions);
      setPosition(latlng: LatLng | LatLngLiteral | null): void;
      getPosition(): LatLng | null;
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: Function): MapsEventListener;
      setAnimation(animation: Animation | null): void;
      setZIndex(zIndex: number): void;
    }

    enum Animation {
      BOUNCE = 1,
      DROP = 2
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map | null;
      draggable?: boolean;
      title?: string;
      icon?: string | Icon | Symbol;
    }

    interface Icon {
      path?: string | SymbolPath;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
      rotation?: number;
    }

    enum SymbolPath {
      CIRCLE = 0,
      BACKWARD_CLOSED_ARROW = 1,
      BACKWARD_OPEN_ARROW = 2,
      FORWARD_CLOSED_ARROW = 3,
      FORWARD_OPEN_ARROW = 4
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    interface MapMouseEvent {
      latLng: LatLng | null;
    }

    interface MapsEventListener {
      remove(): void;
    }

    class InfoWindow {
      constructor(options?: InfoWindowOptions);
      setContent(content: string | HTMLElement): void;
      open(map?: Map | null, anchor?: Marker | null): void;
      close(): void;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
    }

    class LatLngBounds {
      constructor();
      extend(latlng: LatLng | LatLngLiteral): void;
    }

    class Circle {
      constructor(options?: CircleOptions);
      setMap(map: Map | null): void;
    }

    interface CircleOptions {
      center?: LatLng | LatLngLiteral;
      radius?: number;
      map?: Map | null;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }

    namespace event {
      function clearInstanceListeners(instance: any): void;
    }
  }
}

