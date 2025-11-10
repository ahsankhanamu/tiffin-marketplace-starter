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
  }

  let { lat: initialLat = null, lng: initialLng = null, location, onLocationSelect, height = '400px', className = '', readonly = false }: Props = $props();

  // Use location object if provided, otherwise use lat/lng props
  let effectiveLat = $derived(location?.lat ?? initialLat);
  let effectiveLng = $derived(location?.lng ?? initialLng);

  let mapContainer: HTMLDivElement | null = null;
  let map: google.maps.Map | null = null;
  let marker: google.maps.Marker | null = null;
  let mapLoaded = $state(false);
  let error = $state('');

  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API;

  function initMap(): void {
    if (!browser || !mapContainer || !API_KEY) {
      error = API_KEY ? 'Map container not found' : 'Google Maps API key not configured';
      return;
    }

    const defaultCenter = effectiveLat && effectiveLng 
      ? { lat: effectiveLat, lng: effectiveLng }
      : { lat: 24.4539, lng: 54.3773 };

    map = new google.maps.Map(mapContainer, {
      center: defaultCenter,
      zoom: effectiveLat && effectiveLng ? 15 : 10,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    if (effectiveLat && effectiveLng) {
      marker = new google.maps.Marker({
        position: { lat: effectiveLat, lng: effectiveLng },
        map: map,
        draggable: !readonly
      });

      if (!readonly) {
        marker.addListener('dragend', () => {
          if (marker && onLocationSelect) {
            const position = marker.getPosition();
            if (position) {
              onLocationSelect(position.lat(), position.lng());
            }
          }
        });
      }
    }

    if (!readonly) {
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          if (!marker) {
            marker = new google.maps.Marker({
              position: { lat, lng },
              map: map,
              draggable: true
            });

            marker.addListener('dragend', () => {
              if (marker && onLocationSelect) {
                const position = marker.getPosition();
                if (position) {
                  onLocationSelect(position.lat(), position.lng());
                }
              }
            });
          } else {
            marker.setPosition({ lat, lng });
          }

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

  onMount(async () => {
    if (!browser) return;

    if (!API_KEY) {
      error = 'Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API in your environment variables.';
      return;
    }

    try {
      await loadGoogleMapsScript();
      initMap();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load Google Maps';
      console.error('Error loading Google Maps:', err);
    }
  });

  onDestroy(() => {
    if (marker) {
      marker.setMap(null);
    }
    if (map) {
      google.maps.event.clearInstanceListeners(map);
    }
  });

  $effect(() => {
    if (mapLoaded && effectiveLat && effectiveLng && map) {
      const newPosition = { lat: effectiveLat, lng: effectiveLng };
      map.setCenter(newPosition);
      if (marker) {
        marker.setPosition(newPosition);
        marker.setDraggable(!readonly);
      } else {
        marker = new google.maps.Marker({
          position: newPosition,
          map: map,
          draggable: !readonly
        });
        if (!readonly) {
          marker.addListener('dragend', () => {
            if (marker && onLocationSelect) {
              const position = marker.getPosition();
              if (position) {
                onLocationSelect(position.lat(), position.lng());
              }
            }
          });
        }
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
        <div class={cn('w-full h-full flex items-center justify-center bg-muted')}>
          <p class={cn('text-muted-foreground')}>Loading map...</p>
        </div>
      {/if}
    </div>
    {#if !readonly}
      <p class={cn('text-xs text-muted-foreground mt-2')}>
        Click on the map to select your kitchen location. You can drag the marker to adjust.
      </p>
    {/if}
  {/if}
</div>

