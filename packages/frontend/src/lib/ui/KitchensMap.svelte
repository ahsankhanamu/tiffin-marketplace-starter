<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { cn } from '$lib/cn';
  import type { Kitchen } from '$lib/api';

  interface Props {
    kitchens: Kitchen[];
    userLocation?: { lat: number; lng: number } | null;
    height?: string;
    className?: string;
    onKitchenClick?: (kitchen: Kitchen) => void;
    isOwner?: boolean;
  }

  let { kitchens, userLocation, height = '500px', className = '', onKitchenClick, isOwner = false }: Props = $props();

  let mapContainer: HTMLDivElement | null = null;
  let map: google.maps.Map | null = null;
  let markers: google.maps.Marker[] = [];
  let userMarker: google.maps.Marker | null = null;
  let mapLoaded = $state(false);
  let error = $state('');

  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API;

  function initMap(): void {
    if (!browser || !mapContainer || !API_KEY) {
      error = API_KEY ? 'Map container not found' : 'Google Maps API key not configured';
      return;
    }

    // Determine center - use user location if available, otherwise use first kitchen, or default
    let center: { lat: number; lng: number };
    if (userLocation) {
      center = userLocation;
    } else if (kitchens.length > 0 && kitchens[0].location) {
      center = kitchens[0].location;
    } else {
      center = { lat: 24.4539, lng: 54.3773 };
    }

    map = new google.maps.Map(mapContainer, {
      center: center,
      zoom: kitchens.length > 0 ? 13 : 10,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    // Add user location marker if available with accuracy circle
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
      
      // Add accuracy circle (assuming ~30m accuracy, adjust as needed)
      const accuracyCircle = new google.maps.Circle({
        center: userLocation,
        radius: 30, // 30 meters
        map: map,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        strokeColor: '#4285F4',
        strokeOpacity: 0.5,
        strokeWeight: 1
      });
    }

    // Add markers for each kitchen with custom icons
    console.log('Initializing map with kitchens:', kitchens.length);
    kitchens.forEach((kitchen, index) => {
      // Handle different location formats: {lat, lng} or GeoJSON {type: "Point", coordinates: [lng, lat]}
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (kitchen.location) {
        if (typeof kitchen.location === 'object') {
          // Standard format: {lat, lng}
          if ('lat' in kitchen.location && 'lng' in kitchen.location) {
            lat = kitchen.location.lat;
            lng = kitchen.location.lng;
          }
          // GeoJSON format: {type: "Point", coordinates: [lng, lat]}
          else if ('type' in kitchen.location && kitchen.location.type === 'Point' && Array.isArray(kitchen.location.coordinates)) {
            lng = kitchen.location.coordinates[0];
            lat = kitchen.location.coordinates[1];
          }
        }
      }
      
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        console.log(`Adding marker for kitchen ${index + 1}: ${kitchen.title} at ${lat}, ${lng}`);
        
        // Create custom marker icon
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

        // Add info window with kitchen details
        const viewLink = isOwner ? `/owner/kitchens/${kitchen.id}` : `/kitchens/${kitchen.id}`;
        const viewText = isOwner ? 'Manage Kitchen →' : 'View Kitchen →';
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${kitchen.title}</h3>
              ${kitchen.description ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #666; line-height: 1.4;">${kitchen.description.substring(0, 100)}${kitchen.description.length > 100 ? '...' : ''}</p>` : ''}
              ${kitchen.distance_m ? `<p style="margin: 0 0 12px 0; font-size: 12px; color: #888;">📍 Distance: ${Math.round(kitchen.distance_m)} m</p>` : ''}
              <a href="${viewLink}" style="display: inline-block; padding: 8px 16px; background: #4285F4; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500; margin-top: 8px;">${viewText}</a>
            </div>
          `
        });

        marker.addListener('click', () => {
          // Close all other info windows
          markers.forEach((m) => {
            const iw = (m as any).infoWindow;
            if (iw) iw.close();
          });
          
          // Open this marker's info window
          infoWindow.open(map, marker);
          (marker as any).infoWindow = infoWindow;
          
          // Center map on marker
          map.setCenter({ lat, lng });
          map.setZoom(15);
        });

        markers.push(marker);
      } else {
        console.warn(`Kitchen ${index + 1} (${kitchen.title}) has no valid location data:`, kitchen.location);
      }
    });
    console.log(`Initial markers added: ${markers.length} out of ${kitchens.length} kitchens`);

    // Fit bounds to show all markers
    if (markers.length > 0 || userMarker) {
      const bounds = new google.maps.LatLngBounds();
      
      if (userMarker) {
        bounds.extend(userMarker.getPosition()!);
      }
      
      markers.forEach((marker) => {
        const position = marker.getPosition();
        if (position) {
          bounds.extend(position);
        }
      });

      // Only fit bounds if we have multiple points, otherwise just center
      if (markers.length > 1 || (markers.length === 1 && userMarker)) {
        // Add some padding
        const padding = 50;
        map.fitBounds(bounds, { top: padding, right: padding, bottom: padding, left: padding });
      }
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
    markers.forEach((marker) => {
      marker.setMap(null);
    });
    if (userMarker) {
      userMarker.setMap(null);
    }
    if (map) {
      google.maps.event.clearInstanceListeners(map);
    }
  });

  // Update markers when kitchens change
  $effect(() => {
    console.log('$effect triggered - mapLoaded:', mapLoaded, 'map:', !!map, 'kitchens:', kitchens.length);
    if (mapLoaded && map && kitchens.length > 0) {
      // Clear existing markers
      markers.forEach((marker) => {
        marker.setMap(null);
      });
      markers = [];

      // Add new markers
      console.log('Updating markers for kitchens:', kitchens.length);
      let markersAdded = 0;
      kitchens.forEach((kitchen, index) => {
        // Handle different location formats: {lat, lng} or GeoJSON {type: "Point", coordinates: [lng, lat]}
        let lat: number | null = null;
        let lng: number | null = null;
        
        if (kitchen.location) {
          if (typeof kitchen.location === 'object') {
            // Standard format: {lat, lng}
            if ('lat' in kitchen.location && 'lng' in kitchen.location) {
              lat = kitchen.location.lat;
              lng = kitchen.location.lng;
            }
            // GeoJSON format: {type: "Point", coordinates: [lng, lat]}
            else if ('type' in kitchen.location && kitchen.location.type === 'Point' && Array.isArray(kitchen.location.coordinates)) {
              lng = kitchen.location.coordinates[0];
              lat = kitchen.location.coordinates[1];
            }
          }
        }
        
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          console.log(`Adding marker for kitchen ${index + 1}: ${kitchen.title} at ${lat}, ${lng}`);
          
          // Create custom marker icon
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
          markersAdded++;

          const viewLink = isOwner ? `/owner/kitchens/${kitchen.id}` : `/kitchens/${kitchen.id}`;
          const viewText = isOwner ? 'Manage Kitchen →' : 'View Kitchen →';
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${kitchen.title}</h3>
                ${kitchen.description ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #666; line-height: 1.4;">${kitchen.description.substring(0, 100)}${kitchen.description.length > 100 ? '...' : ''}</p>` : ''}
                ${kitchen.distance_m ? `<p style="margin: 0 0 12px 0; font-size: 12px; color: #888;">📍 Distance: ${Math.round(kitchen.distance_m)} m</p>` : ''}
                <a href="${viewLink}" style="display: inline-block; padding: 8px 16px; background: #4285F4; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500; margin-top: 8px;">${viewText}</a>
              </div>
            `
          });

          marker.addListener('click', () => {
            // Close all other info windows
            markers.forEach((m) => {
              const iw = (m as any).infoWindow;
              if (iw) iw.close();
            });
            
            // Open this marker's info window
            infoWindow.open(map, marker);
            (marker as any).infoWindow = infoWindow;
            
            // Center map on marker
            map.setCenter({ lat, lng });
            map.setZoom(15);
          });

          markers.push(marker);
        } else {
          console.warn(`Kitchen ${index + 1} (${kitchen.title}) has no valid location data:`, kitchen.location);
        }
      });
      console.log(`Total markers added: ${markersAdded} out of ${kitchens.length} kitchens`);

      // Update bounds
      if (markers.length > 0 || userMarker) {
        const bounds = new google.maps.LatLngBounds();
        
        if (userMarker) {
          bounds.extend(userMarker.getPosition()!);
        }
        
        markers.forEach((marker) => {
          const position = marker.getPosition();
          if (position) {
            bounds.extend(position);
          }
        });

        if (markers.length > 1 || (markers.length === 1 && userMarker)) {
          const padding = 50;
          map.fitBounds(bounds, { top: padding, right: padding, bottom: padding, left: padding });
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
  {/if}
</div>

