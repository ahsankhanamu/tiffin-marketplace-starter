<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { cn } from '$lib/cn';
  import { getNearby, type Kitchen } from '$lib/api';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { Star, UtensilsCrossed } from '$lib/icons';

  interface Props {
    userLocation?: { lat: number; lng: number } | null;
    height?: string;
    className?: string;
    onKitchenClick?: (kitchen: Kitchen) => void;
  }

  let { userLocation, height = '600px', className = '', onKitchenClick }: Props = $props();

  let mapContainer: HTMLDivElement | null = null;
  let map: google.maps.Map | null = null;
  let markers: google.maps.Marker[] = [];
  let userMarker: google.maps.Marker | null = null;
  let mapLoaded = $state(false);
  let error = $state('');
  let kitchens = $state<Kitchen[]>([]);
  let loading = $state(false);
  let selectedKitchen = $state<Kitchen | null>(null);
  let fetchTimeout: ReturnType<typeof setTimeout> | null = null;
  let isFittingBounds = $state(false);
  let lastKitchensCount = $state(0);
  let lastKitchensHash = $state<string>('');
  let initialFetchDone = $state(false);

  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API;
  const MAX_RADIUS_M = 10000; // 10km in meters
  const MIN_ZOOM = 15; // Minimum zoom level to ensure markers are clearly visible

  function calculateRadiusFromBounds(bounds: google.maps.LatLngBounds): number {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const center = bounds.getCenter();
    
    const R = 6371000; // Earth radius in meters
    const lat1 = center.lat() * Math.PI / 180;
    const lat2 = ne.lat() * Math.PI / 180;
    const dLat = (ne.lat() - center.lat()) * Math.PI / 180;
    const dLng = (ne.lng() - center.lng()) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  async function fetchKitchens(center: { lat: number; lng: number }, radius: number): Promise<void> {
    if (radius > MAX_RADIUS_M) {
      kitchens = [];
      clearMarkers();
      return;
    }

    loading = true;
    try {
      const fetchedKitchens = await getNearby(center.lng, center.lat, radius);
      console.log('Fetched kitchens from API:', fetchedKitchens.length);
      console.log('Kitchens with location:', fetchedKitchens.filter(k => k.location).length);
      
      // Only update if kitchens actually changed (prevent unnecessary re-renders)
      const newHash = fetchedKitchens.map(k => k.id).sort().join(',');
      if (newHash !== lastKitchensHash) {
        kitchens = fetchedKitchens;
      }
      // Markers will be updated via $effect when kitchens change
    } catch (err) {
      console.error('Error fetching kitchens:', err);
      if (kitchens.length > 0) {
        kitchens = [];
        clearMarkers();
        lastKitchensHash = '';
        lastKitchensCount = 0;
      }
    } finally {
      loading = false;
    }
  }

  function clearMarkers(): void {
    markers.forEach((marker) => {
      marker.setMap(null);
    });
    markers = [];
  }

  function updateMarkers(): void {
    if (!map) {
      console.warn('Map not initialized, cannot update markers');
      return;
    }

    clearMarkers();

    console.log('Updating markers for kitchens:', kitchens.length);
    
    kitchens.forEach((kitchen, index) => {
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (kitchen.location) {
        if (typeof kitchen.location === 'object') {
          if ('lat' in kitchen.location && 'lng' in kitchen.location) {
            lat = kitchen.location.lat;
            lng = kitchen.location.lng;
          } else if ('type' in kitchen.location && kitchen.location.type === 'Point' && Array.isArray(kitchen.location.coordinates)) {
            lng = kitchen.location.coordinates[0];
            lat = kitchen.location.coordinates[1];
          }
        }
      }
      
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        console.log(`Creating marker ${index + 1} for ${kitchen.title} at ${lat}, ${lng}`);
        
        const markerIcon = {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#FF6B6B',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          rotation: 180
        };
        
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: map,
          title: kitchen.title,
          icon: markerIcon,
          animation: google.maps.Animation.DROP,
          zIndex: 100
        });

        marker.addListener('click', () => {
          selectedKitchen = kitchen;
          map.setCenter({ lat, lng });
          map.setZoom(Math.max(map.getZoom() || 15, 15));
        });

        markers.push(marker);
      } else {
        console.warn(`Kitchen ${index + 1} (${kitchen.title}) has no valid location:`, kitchen.location);
      }
    });
    
    console.log(`Created ${markers.length} markers out of ${kitchens.length} kitchens`);
  }

  function handleMapChange(): void {
    if (!map || !mapLoaded || isFittingBounds) return;

    if (fetchTimeout) {
      clearTimeout(fetchTimeout);
    }

    fetchTimeout = setTimeout(() => {
      if (!map || isFittingBounds) return;

      const bounds = map.getBounds();
      if (!bounds) return;

      const center = map.getCenter();
      if (!center) return;

      const radius = calculateRadiusFromBounds(bounds);
      
      if (radius <= MAX_RADIUS_M) {
        fetchKitchens({ lat: center.lat(), lng: center.lng() }, radius);
      } else {
        kitchens = [];
        clearMarkers();
      }
    }, 500);
  }

  function fitBoundsToShowMarkers(): void {
    if (!map || isFittingBounds || !mapLoaded) return;

    isFittingBounds = true;
    
    // Temporarily remove listeners to prevent triggering handleMapChange
    try {
      google.maps.event.clearListeners(map, 'bounds_changed');
      google.maps.event.clearListeners(map, 'center_changed');
      google.maps.event.clearListeners(map, 'zoom_changed');
    } catch (e) {
      // Listeners might not exist yet
    }
    
    // Use ACTUAL kitchen coordinates to create bounds - don't calculate from radius!
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Add user location to bounds
    if (userLocation) {
      bounds.extend(userLocation);
      hasPoints = true;
    }

    // Add all kitchen markers using their ACTUAL coordinates
    markers.forEach((marker) => {
      const position = marker.getPosition();
      if (position) {
        bounds.extend(position);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      // Use fitBounds with the actual coordinates - this will zoom to show all markers
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!map) {
            isFittingBounds = false;
            return;
          }
          
          google.maps.event.trigger(map, 'resize');
          
          // Fit bounds to show all markers and user location
          // This uses the ACTUAL coordinates, so it will zoom appropriately
          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
          
          setTimeout(() => {
            if (map) {
              const currentZoom = map.getZoom() || MIN_ZOOM;
              
              // CRITICAL: Always enforce minimum zoom to ensure markers are clearly visible
              // If fitBounds zoomed out too far, zoom in to MIN_ZOOM
              if (currentZoom < MIN_ZOOM) {
                map.setZoom(MIN_ZOOM);
                // Re-center on the bounds center to keep markers in view
                const center = bounds.getCenter();
                if (center) {
                  map.setCenter(center);
                }
              }
              
              // Re-add listeners
              setTimeout(() => {
                if (map && initialFetchDone) {
                  map.addListener('bounds_changed', handleMapChange);
                  map.addListener('center_changed', handleMapChange);
                  map.addListener('zoom_changed', handleMapChange);
                }
                isFittingBounds = false;
              }, 300);
            }
          }, 200);
        });
      });
    } else if (userLocation) {
      // Only user location, center and set zoom to minimum
      requestAnimationFrame(() => {
        if (map) {
          google.maps.event.trigger(map, 'resize');
          map.setCenter(userLocation);
          map.setZoom(MIN_ZOOM);
          setTimeout(() => {
            if (map && initialFetchDone) {
              map.addListener('bounds_changed', handleMapChange);
              map.addListener('center_changed', handleMapChange);
              map.addListener('zoom_changed', handleMapChange);
            }
            isFittingBounds = false;
          }, 300);
        }
      });
    } else {
      isFittingBounds = false;
    }
  }

  function initMap(): void {
    if (!browser || !mapContainer || !API_KEY) {
      error = API_KEY ? 'Map container not found' : 'Google Maps API key not configured';
      return;
    }

    const defaultCenter = userLocation || { lat: 24.4539, lng: 54.3773 };
    const defaultZoom = MIN_ZOOM;

    map = new google.maps.Map(mapContainer, {
      center: defaultCenter,
      zoom: defaultZoom,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    if (userLocation) {
      userMarker = new google.maps.Marker({
        position: userLocation,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        },
        title: 'Your Location',
        zIndex: 1000
      });
      
      const accuracyCircle = new google.maps.Circle({
        center: userLocation,
        radius: 30,
        map: map,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        strokeColor: '#4285F4',
        strokeOpacity: 0.5,
        strokeWeight: 1
      });
    }

    mapLoaded = true;

    // Wait for map to be fully ready before fetching kitchens (only once on initial load)
    // Don't add map change listeners yet to prevent duplicate API calls
    const initialIdleListener = map.addListener('idle', () => {
      // Remove this listener after first execution
      google.maps.event.removeListener(initialIdleListener);
      
      if (initialFetchDone) return;
      initialFetchDone = true;

      // Center on user location at minimum zoom level where markers appear
      if (userLocation) {
        map.setCenter(userLocation);
        map.setZoom(MIN_ZOOM);
      }

      // Wait a bit for map to settle, then fetch kitchens
      setTimeout(() => {
        const bounds = map.getBounds();
        if (bounds) {
          const center = map.getCenter();
          if (center) {
            const radius = calculateRadiusFromBounds(bounds);
            if (radius <= MAX_RADIUS_M) {
              fetchKitchens({ lat: center.lat(), lng: center.lng() }, radius);
            }
          }
        } else if (userLocation) {
          // If bounds not ready yet, use user location directly
          fetchKitchens(userLocation, 5000); // Start with 5km radius
        }
        
        // Now add the map change listeners after initial fetch is done
        // This prevents duplicate API calls during initialization
        map.addListener('bounds_changed', handleMapChange);
        map.addListener('center_changed', handleMapChange);
        map.addListener('zoom_changed', handleMapChange);
      }, 100);
    });
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

  function handleKitchenCardClick(kitchen: Kitchen): void {
    if (onKitchenClick) {
      onKitchenClick(kitchen);
    } else {
      goto(`/kitchens/${kitchen.id}`);
    }
  }

  function getMealTypeLabel(mealType: string): string {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
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

  // Update markers when kitchens change (only when actually changed to prevent loops)
  $effect(() => {
    if (mapLoaded && map && !isFittingBounds) {
      const currentCount = kitchens.length;
      // Create a simple hash of kitchen IDs to detect actual changes
      const currentHash = kitchens.map(k => k.id).sort().join(',');
      
      // Only update if kitchens actually changed (count or IDs)
      if (currentCount !== lastKitchensCount || currentHash !== lastKitchensHash) {
        lastKitchensCount = currentCount;
        lastKitchensHash = currentHash;
        
        if (currentCount > 0) {
          updateMarkers();
          // Auto-zoom to show user location and markers after markers are created
          // Use multiple requestAnimationFrame calls to ensure markers are fully rendered
          // Wait longer to ensure markers are fully created and positioned
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(() => {
                // Always try to fit bounds if we have markers or user location
                if (!isFittingBounds && map && mapLoaded) {
                  // Check if we have markers or user location to show
                  if (markers.length > 0 || userLocation) {
                    fitBoundsToShowMarkers();
                  }
                }
              }, 600);
            });
          });
        } else {
          clearMarkers();
          // If no kitchens, center on user location at minimum zoom
          if (userLocation && !isFittingBounds) {
            isFittingBounds = true;
            map.setCenter(userLocation);
            map.setZoom(MIN_ZOOM);
            setTimeout(() => {
              isFittingBounds = false;
            }, 300);
          }
        }
      }
    }
  });

  onDestroy(() => {
    if (fetchTimeout) {
      clearTimeout(fetchTimeout);
    }
    clearMarkers();
    if (userMarker) {
      userMarker.setMap(null);
    }
    if (map) {
      google.maps.event.clearInstanceListeners(map);
    }
  });
</script>

<div class={cn('w-full relative', className)}>
  {#if error}
    <div class={cn('p-4 rounded-md bg-destructive/10 text-destructive text-sm')}>
      {error}
    </div>
  {:else}
    <div class={cn('relative w-full')}>
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

      {#if loading}
        <div class={cn('absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-md')}>
          <p class={cn('text-sm text-muted-foreground')}>Loading kitchens...</p>
        </div>
      {/if}

      {#if kitchens.length === 0 && mapLoaded && !loading}
        <div class={cn('absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-md')}>
          <p class={cn('text-sm text-muted-foreground')}>
            {#if map}
              {(() => {
                const bounds = map.getBounds();
                const radius = bounds ? calculateRadiusFromBounds(bounds) : 0;
                return radius > MAX_RADIUS_M
                  ? 'Zoom in to see nearby kitchens (max 10km radius)'
                  : 'No kitchens found in this area';
              })()}
            {/if}
          </p>
        </div>
      {/if}

      {#if selectedKitchen}
        <div class={cn('absolute bottom-4 left-4 right-4 z-10 max-w-md mx-auto')}>
          <Card class={cn('p-4 cursor-pointer hover:shadow-lg transition-shadow')} onclick={() => handleKitchenCardClick(selectedKitchen)}>
            <div class={cn('flex items-start justify-between gap-3')}>
              <div class={cn('flex-1')}>
                <h3 class={cn('text-lg font-semibold mb-2')}>{selectedKitchen.title}</h3>
                
                {#if selectedKitchen.mealTypes && selectedKitchen.mealTypes.length > 0}
                  <div class={cn('flex flex-wrap gap-2 mb-2')}>
                    {#each selectedKitchen.mealTypes as mealType}
                      <Badge variant="secondary" class={cn('text-xs')}>
                        <UtensilsCrossed class={cn('w-3 h-3 mr-1')} />
                        {getMealTypeLabel(mealType)}
                      </Badge>
                    {/each}
                  </div>
                {/if}

                <div class={cn('flex items-center gap-4')}>
                  {#if selectedKitchen.rating !== undefined}
                    <div class={cn('flex items-center gap-1')}>
                      <Star class={cn('w-4 h-4 fill-yellow-400 text-yellow-400')} />
                      <span class={cn('text-sm font-medium')}>
                        {selectedKitchen.rating > 0 ? selectedKitchen.rating.toFixed(1) : 'N/A'}
                      </span>
                    </div>
                  {/if}
                  
                  {#if selectedKitchen.distance_m}
                    <span class={cn('text-xs text-muted-foreground')}>
                      {selectedKitchen.distance_m < 1000 
                        ? `${Math.round(selectedKitchen.distance_m)}m away`
                        : `${(selectedKitchen.distance_m / 1000).toFixed(1)}km away`}
                    </span>
                  {/if}
                </div>
              </div>
              
              <button
                class={cn('text-muted-foreground hover:text-foreground transition-colors')}
                onclick={(e) => {
                  e.stopPropagation();
                  selectedKitchen = null;
                }}
                aria-label="Close"
              >
                <svg class={cn('w-5 h-5')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </Card>
        </div>
      {/if}
    </div>
  {/if}
</div>
