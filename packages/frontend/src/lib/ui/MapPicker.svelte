<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { cn } from '$lib/cn';

  interface Props {
    lat?: number | null;
    lng?: number | null;
    location?: { lat: number; lng: number } | null;
    onLocationSelect?: (lat: number, lng: number) => void;
    height?: string;
    className?: string;
    readonly?: boolean;
    enabled?: boolean;
    showCoordinates?: boolean;
  }

  let { lat: initialLat = null, lng: initialLng = null, location, onLocationSelect, height = '400px', className = '', readonly = false, enabled = true, showCoordinates = true }: Props = $props();

  // Use location object if provided, otherwise use lat/lng props
  // Handle both {lat, lng} and GeoJSON {type: "Point", coordinates: [lng, lat]} formats
  let effectiveLat = $derived.by(() => {
    if (location) {
      if ('lat' in location && 'lng' in location) {
        return location.lat;
      } else if ('type' in location && location.type === 'Point' && Array.isArray(location.coordinates)) {
        return location.coordinates[1]; // GeoJSON: [lng, lat]
      }
    }
    return initialLat;
  });
  
  let effectiveLng = $derived.by(() => {
    if (location) {
      if ('lat' in location && 'lng' in location) {
        return location.lng;
      } else if ('type' in location && location.type === 'Point' && Array.isArray(location.coordinates)) {
        return location.coordinates[0]; // GeoJSON: [lng, lat]
      }
    }
    return initialLng;
  });

  let mapContainer: HTMLDivElement | null = null;
  let map: google.maps.Map | null = null;
  let marker: google.maps.Marker | null = null;
  let mapLoaded = $state(false);
  let error = $state('');
  let currentLat = $state<number | null>(null);
  let currentLng = $state<number | null>(null);
  let panTimeout: ReturnType<typeof setTimeout> | null = null;

  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API;

  function createMarker(lat: number, lng: number): void {
    if (!map) return;

    if (marker) {
      marker.setMap(null);
    }

    const markerOptions: google.maps.MarkerOptions = {
      position: { lat, lng },
      map: map,
      draggable: enabled && !readonly,
      animation: google.maps.Animation.DROP
    };

    if (readonly) {
      markerOptions.icon = {
        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32)
      };
    } else {
      markerOptions.icon = {
        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32)
      };
    }

    marker = new google.maps.Marker(markerOptions);

    if (enabled && !readonly) {
      marker.addListener('dragend', () => {
        if (marker && onLocationSelect) {
          const position = marker.getPosition();
          if (position) {
            currentLat = position.lat();
            currentLng = position.lng();
            onLocationSelect(currentLat, currentLng);
          }
        }
      });
    }
  }

  function initMap(): void {
    if (!browser || !mapContainer || !API_KEY) {
      error = API_KEY ? 'Map container not found' : 'Google Maps API key not configured';
      return;
    }

    const lat = effectiveLat;
    const lng = effectiveLng;
    const defaultCenter = (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng))
      ? { lat, lng }
      : { lat: 24.4539, lng: 54.3773 };

    map = new google.maps.Map(mapContainer, {
      center: defaultCenter,
      zoom: (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) ? 15 : 10,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      currentLat = lat;
      currentLng = lng;
      createMarker(lat, lng);
      map.setCenter({ lat, lng });
      map.setZoom(15);
    } else if (enabled && !readonly) {
      const center = map.getCenter();
      if (center) {
        currentLat = center.lat();
        currentLng = center.lng();
        createMarker(currentLat, currentLng);
      }
    }

    if (enabled && !readonly) {
      map.addListener('center_changed', () => {
        if (panTimeout) {
          clearTimeout(panTimeout);
        }
        panTimeout = setTimeout(() => {
          if (map && marker) {
            const center = map.getCenter();
            if (center) {
              const lat = center.lat();
              const lng = center.lng();
              marker.setPosition({ lat, lng });
              currentLat = lat;
              currentLng = lng;
              if (onLocationSelect) {
                onLocationSelect(lat, lng);
              }
            }
          }
        }, 300);
      });
    }

    if (enabled && !readonly) {
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          if (!marker) {
            createMarker(lat, lng);
          } else {
            marker.setPosition({ lat, lng });
          }

          currentLat = lat;
          currentLng = lng;

          if (onLocationSelect) {
            onLocationSelect(lat, lng);
          }
        }
      });
    }

    mapLoaded = true;
  }

  function loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps script'));
      document.head.appendChild(script);
    });
  }

  let mapInitialized = $state(false);

  onMount(async () => {
    if (!browser) return;

    if (!API_KEY) {
      error = 'Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API in your environment variables.';
      return;
    }

    // If not readonly, initialize immediately
    if (!readonly) {
      try {
        await loadGoogleMapsScript();
        initMap();
        mapInitialized = true;
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to load Google Maps';
        console.error('Error loading Google Maps:', err);
      }
    }
  });

  // Watch for location in readonly mode and initialize map when available
  $effect(() => {
    if (readonly && !mapInitialized && browser && API_KEY) {
      const lat = effectiveLat;
      const lng = effectiveLng;
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        loadAndInitMap();
        mapInitialized = true;
      }
    }
  });

  async function loadAndInitMap(): Promise<void> {
    if (mapInitialized) return;
    try {
      await loadGoogleMapsScript();
      initMap();
      mapInitialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load Google Maps';
      console.error('Error loading Google Maps:', err);
    }
  }

  onDestroy(() => {
    if (panTimeout) {
      clearTimeout(panTimeout);
    }
    if (marker) {
      marker.setMap(null);
    }
    if (map) {
      google.maps.event.clearInstanceListeners(map);
    }
  });

  $effect(() => {
    if (mapLoaded && map) {
      const lat = effectiveLat;
      const lng = effectiveLng;
      
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        const newPosition = { lat, lng };
        currentLat = lat;
        currentLng = lng;
        map.setCenter(newPosition);
        map.setZoom(15);
        if (marker) {
          marker.setPosition(newPosition);
          marker.setDraggable(enabled && !readonly);
        } else {
          createMarker(lat, lng);
        }
      } else if (enabled && !readonly && !marker) {
        const center = map.getCenter();
        if (center) {
          currentLat = center.lat();
          currentLng = center.lng();
          createMarker(currentLat, currentLng);
        }
      }
    }
  });

  $effect(() => {
    if (mapLoaded && map) {
      const lat = effectiveLat;
      const lng = effectiveLng;
      
      if (readonly && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        if (!marker) {
          createMarker(lat, lng);
        } else {
          marker.setDraggable(false);
          if (!marker.getMap()) {
            marker.setMap(map);
          }
        }
      } else if (enabled && !readonly) {
        if (!marker) {
          const center = map.getCenter();
          if (center) {
            const markerLat = lat ?? center.lat();
            const markerLng = lng ?? center.lng();
            createMarker(markerLat, markerLng);
            currentLat = markerLat;
            currentLng = markerLng;
          }
        } else {
          marker.setDraggable(true);
          if (!marker.getMap()) {
            marker.setMap(map);
          }
        }
      } else if (marker && (lat === null || lng === null || isNaN(lat) || isNaN(lng))) {
        marker.setMap(null);
        marker = null;
      }
    }
  });
</script>

<div class={cn('w-full', className)}>
  {#if error}
    <div class={cn('p-4 rounded-md bg-destructive/10 text-destructive text-sm')}>
      {error}
    </div>
  {:else}
    <div
      bind:this={mapContainer}
      class={cn('w-full rounded-lg border border-border overflow-hidden')}
      style="height: {height};"
    >
      {#if !mapLoaded}
        <div class={cn('w-full h-full flex items-center justify-center bg-muted animate-pulse')}>
          {#if readonly && !effectiveLat && !effectiveLng}
            <div class={cn('text-center space-y-2')}>
              <div class={cn('w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto')}></div>
              <p class={cn('text-sm text-muted-foreground')}>Loading location...</p>
            </div>
          {:else}
            <div class={cn('text-center space-y-2')}>
              <div class={cn('w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto')}></div>
              <p class={cn('text-sm text-muted-foreground')}>Loading map...</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    {#if enabled && !readonly}
      <div class={cn('mt-2 space-y-1')}>
        <p class={cn('text-xs text-muted-foreground')}>
          Pan the map or click to set location. Drag the marker to fine-tune.
        </p>
        {#if showCoordinates && currentLat !== null && currentLng !== null}
          <div class={cn('text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded')}>
            Lat: {currentLat.toFixed(6)}, Lng: {currentLng.toFixed(6)}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

