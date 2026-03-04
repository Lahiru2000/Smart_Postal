import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Cloud,
  CloudRain,
  Sun,
  ArrowRight,
  RefreshCw,
  Send,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  CheckCheck,
  CloudLightning,
  CloudSnow,
  CloudDrizzle,
  Route,
  Gauge,
  Wind,
  Droplets,
  Download,
  RotateCcw,
} from "lucide-react";
import { getShipments } from "../services/api";

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  "AIzaSyBb760vN7Xd17NPIE8q_GhpXCLViUJtr8Q";

// ═══════════════════════════════════════════
//  PRIORITY CONFIGURATION
// ═══════════════════════════════════════════
const PRIORITIES = {
  urgent: {
    label: "Urgent",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    order: 0,
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    order: 1,
  },
  normal: {
    label: "Normal",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    order: 2,
  },
  low: {
    label: "Low",
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    order: 3,
  },
};

// ═══════════════════════════════════════════
//  WEATHER CODE INTERPRETATION (WMO codes)
// ═══════════════════════════════════════════
const getWeatherInfo = (code) => {
  if (code === 0)
    return {
      condition: "Clear Sky",
      icon: "sun",
      color: "#22C55E",
      severity: 0,
    };
  if (code <= 3)
    return {
      condition: "Partly Cloudy",
      icon: "cloud",
      color: "#9CA3AF",
      severity: 1,
    };
  if (code <= 48)
    return { condition: "Foggy", icon: "cloud", color: "#6B7280", severity: 1 };
  if (code <= 55)
    return {
      condition: "Drizzle",
      icon: "drizzle",
      color: "#93C5FD",
      severity: 2,
    };
  if (code <= 57)
    return {
      condition: "Freezing Drizzle",
      icon: "drizzle",
      color: "#60A5FA",
      severity: 3,
    };
  if (code <= 65)
    return { condition: "Rain", icon: "rain", color: "#3B82F6", severity: 3 };
  if (code <= 67)
    return {
      condition: "Freezing Rain",
      icon: "rain",
      color: "#2563EB",
      severity: 4,
    };
  if (code <= 77)
    return { condition: "Snow", icon: "snow", color: "#E5E7EB", severity: 3 };
  if (code <= 82)
    return {
      condition: "Rain Showers",
      icon: "rain",
      color: "#3B82F6",
      severity: 3,
    };
  if (code <= 86)
    return {
      condition: "Snow Showers",
      icon: "snow",
      color: "#E5E7EB",
      severity: 3,
    };
  if (code <= 99)
    return {
      condition: "Thunderstorm",
      icon: "storm",
      color: "#8B5CF6",
      severity: 5,
    };
  return { condition: "Unknown", icon: "cloud", color: "#6B7280", severity: 0 };
};

// ═══════════════════════════════════════════
//  HAVERSINE DISTANCE (km)
// ═══════════════════════════════════════════
const haversineKm = (p1, p2) => {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ═══════════════════════════════════════════
//  DARK MAP STYLE
// ═══════════════════════════════════════════
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

// ═══════════════════════════════════════════
//  HELPER: WEATHER ICON COMPONENT
// ═══════════════════════════════════════════
const WeatherIcon = ({ icon, className = "w-5 h-5" }) => {
  switch (icon) {
    case "sun":
      return <Sun className={className} />;
    case "rain":
      return <CloudRain className={className} />;
    case "drizzle":
      return <CloudDrizzle className={className} />;
    case "snow":
      return <CloudSnow className={className} />;
    case "storm":
      return <CloudLightning className={className} />;
    default:
      return <Cloud className={className} />;
  }
};

// ═══════════════════════════════════════════
//  FORMAT HELPERS
// ═══════════════════════════════════════════
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatDistance = (meters) => {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
};

const getPriorityMarkerColor = (priority) => {
  switch (priority) {
    case "urgent":
      return "#EF4444";
    case "high":
      return "#F97316";
    case "normal":
      return "#FFC000";
    case "low":
      return "#6B7280";
    default:
      return "#FFC000";
  }
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                   ROUTE OPTIMIZER                        ║
// ╚═══════════════════════════════════════════════════════════╝

const RouteOptimizer = () => {
  const navigate = useNavigate();

  // ── Core state ──
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [locationCount, setLocationCount] = useState(5);
  const [routeResults, setRouteResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  // ── Feature toggles ──
  const [trafficLayerObj, setTrafficLayerObj] = useState(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [priorityMode, setPriorityMode] = useState(false);
  const [showWeatherLayer, setShowWeatherLayer] = useState(true);

  // ── Weather ──
  const [weatherData, setWeatherData] = useState([]);
  const [weatherCircles, setWeatherCircles] = useState([]);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // ── Sharing ──
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [copied, setCopied] = useState(false);

  // ── Import ──
  const [showImport, setShowImport] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [loadingShipments, setLoadingShipments] = useState(false);

  // ── Refs ──
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const markersRef = useRef([]);

  // Keep ref in sync with state
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // ═══════════════════════════════════════════
  //  GOOGLE MAPS SCRIPT LOADING
  // ═══════════════════════════════════════════

  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoading(false);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoading(false);
    };

    script.onerror = () => {
      setError("Failed to load Google Maps. Check your API key.");
      setIsLoading(false);
    };

    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  // Init map when showMap becomes true
  useEffect(() => {
    if (showMap && !isLoading && !map && window.google) initializeMap();
  }, [showMap, isLoading, map]);

  // ── Traffic layer toggle ──
  useEffect(() => {
    if (!map) return;
    if (showTraffic) {
      if (!trafficLayerObj) {
        const tl = new window.google.maps.TrafficLayer();
        tl.setMap(map);
        setTrafficLayerObj(tl);
      } else {
        trafficLayerObj.setMap(map);
      }
    } else {
      if (trafficLayerObj) trafficLayerObj.setMap(null);
    }
  }, [showTraffic, map]);

  // ── Weather circle visibility toggle ──
  useEffect(() => {
    weatherCircles.forEach((c) => c.setMap(showWeatherLayer ? map : null));
  }, [showWeatherLayer, weatherCircles, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      weatherCircles.forEach((c) => c.setMap(null));
    };
  }, []);

  // ═══════════════════════════════════════════
  //  MAP INITIALIZATION
  // ═══════════════════════════════════════════

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    try {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 7.8731, lng: 80.7718 }, // Sri Lanka center
        zoom: 7,
        styles: DARK_MAP_STYLE,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      const renderer = new window.google.maps.DirectionsRenderer({
        map: newMap,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#FFC000",
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });
      setDirectionsRenderer(renderer);

      newMap.addListener("click", (e) => handleMapClick(e, newMap));
      setMap(newMap);

      // Setup search box
      if (searchInputRef.current) {
        const sb = new window.google.maps.places.SearchBox(
          searchInputRef.current,
        );
        sb.addListener("places_changed", () => handlePlacesChanged(sb, newMap));
        newMap.addListener("bounds_changed", () =>
          sb.setBounds(newMap.getBounds()),
        );
      }
    } catch (err) {
      console.error("Map init error:", err);
      setError("Failed to initialize the map");
    }
  };

  // ═══════════════════════════════════════════
  //  LOCATION MANAGEMENT
  // ═══════════════════════════════════════════

  const handlePlacesChanged = (searchBox, currentMap) => {
    const places = searchBox.getPlaces();
    if (!places || places.length === 0) return;

    if (markersRef.current.length >= locationCount) {
      alert(`Maximum ${locationCount} locations allowed`);
      if (searchInputRef.current) searchInputRef.current.value = "";
      return;
    }

    const place = places[0];
    const loc = place.geometry.location;
    let name = place.name;
    if (place.formatted_address && place.formatted_address !== place.name) {
      name = `${place.name}, ${place.formatted_address}`;
    }

    addMarkerAndLocation(loc.lat(), loc.lng(), name, currentMap);
    currentMap.setCenter(loc);
    currentMap.setZoom(14);
    if (searchInputRef.current) searchInputRef.current.value = "";
  };

  const handleMapClick = (e, currentMap) => {
    if (markersRef.current.length >= locationCount) {
      alert(`Maximum ${locationCount} locations allowed`);
      return;
    }

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      const name =
        status === "OK" && results[0]
          ? results[0].formatted_address
          : `Location ${markersRef.current.length + 1}`;
      addMarkerAndLocation(lat, lng, name, currentMap);
    });
  };

  const addMarkerAndLocation = (lat, lng, name, currentMap) => {
    if (!window.google || !currentMap) return;
    if (markersRef.current.length >= locationCount) {
      alert(`Maximum ${locationCount} locations allowed`);
      return;
    }

    const idx = markersRef.current.length;
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: currentMap,
      draggable: true,
      label: {
        text: `${idx + 1}`,
        color: "#000",
        fontWeight: "bold",
        fontSize: "12px",
      },
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#FFC000",
        fillOpacity: 1,
        strokeColor: "#000",
        strokeWeight: 2,
      },
    });

    marker.addListener("dragend", (e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat: newLat, lng: newLng } },
        (results, status) => {
          const newName =
            status === "OK" && results[0] ? results[0].formatted_address : name;
          setMarkers((prev) =>
            prev.map((m) =>
              m.marker === marker
                ? { ...m, lat: newLat, lng: newLng, name: newName }
                : m,
            ),
          );
        },
      );
    });

    setMarkers((prev) => [
      ...prev,
      { marker, name, lat, lng, priority: "normal" },
    ]);
  };

  const deleteLocation = (index) => {
    const newMarkers = [...markers];
    if (newMarkers[index].marker) newMarkers[index].marker.setMap(null);
    newMarkers.splice(index, 1);

    // Re-label remaining markers
    newMarkers.forEach((m, i) => {
      m.marker.setLabel({
        text: `${i + 1}`,
        color: "#000",
        fontWeight: "bold",
        fontSize: "12px",
      });
    });

    setMarkers(newMarkers);
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    setRouteResults(null);
    clearWeather();
  };

  const updatePriority = (index, priority) => {
    setMarkers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, priority } : m)),
    );
  };

  // ═══════════════════════════════════════════
  //  ROUTE OPTIMIZATION
  // ═══════════════════════════════════════════

  const optimizeRoute = async () => {
    if (markers.length < 2) {
      alert("Please add at least 2 locations");
      return;
    }

    setError(null);
    setOptimizing(true);

    try {
      let orderedLocations = markers.map((m) => ({
        name: m.name,
        lat: m.marker.getPosition().lat(),
        lng: m.marker.getPosition().lng(),
        priority: m.priority,
      }));

      const origin = orderedLocations[0];
      const destination = orderedLocations[orderedLocations.length - 1];
      let waypoints = orderedLocations.slice(1, -1);
      let optimizeWaypoints = true;

      // Priority mode: sort waypoints by urgency, don't auto-reorder
      if (priorityMode && waypoints.length > 0) {
        waypoints.sort(
          (a, b) => PRIORITIES[a.priority].order - PRIORITIES[b.priority].order,
        );
        optimizeWaypoints = false;
      }

      const directionsService = new window.google.maps.DirectionsService();

      const request = {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(
          destination.lat,
          destination.lng,
        ),
        waypoints: waypoints.map((w) => ({
          location: new window.google.maps.LatLng(w.lat, w.lng),
          stopover: true,
        })),
        optimizeWaypoints,
        travelMode: "DRIVING",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess",
        },
      };

      directionsService.route(request, async (result, status) => {
        if (status !== "OK") {
          setError(
            `Route calculation failed: ${status}. Try different locations.`,
          );
          setOptimizing(false);
          return;
        }

        directionsRenderer.setDirections(result);

        // Calculate totals
        let totalDuration = 0;
        let totalDistance = 0;
        const legs = result.routes[0].legs;

        legs.forEach((leg) => {
          totalDuration += leg.duration.value;
          totalDistance += leg.distance.value;
        });

        // Build optimized route
        const waypointOrder = result.routes[0].waypoint_order;
        let optimizedRoute;

        if (optimizeWaypoints && waypointOrder) {
          optimizedRoute = [
            origin,
            ...waypointOrder.map((i) => waypoints[i]),
            destination,
          ];
        } else {
          optimizedRoute = [origin, ...waypoints, destination];
        }

        const googleMapsUrl = `https://www.google.com/maps/dir/${optimizedRoute
          .map((loc) => `${loc.lat},${loc.lng}`)
          .join("/")}`;

        setRouteResults({
          totalDuration,
          totalDistance,
          optimizedRoute,
          googleMapsUrl,
          legs,
        });

        // Update markers with optimized order and priority-colored icons
        markers.forEach((m) => m.marker.setMap(null));
        const newMarkers = optimizedRoute.map((loc, i) => {
          const marker = new window.google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map,
            label: {
              text: `${i + 1}`,
              color: "#000",
              fontWeight: "bold",
              fontSize: "12px",
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: getPriorityMarkerColor(loc.priority),
              fillOpacity: 1,
              strokeColor: "#000",
              strokeWeight: 2,
            },
          });
          return {
            marker,
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            priority: loc.priority,
          };
        });
        setMarkers(newMarkers);

        // Fit to bounds
        const bounds = new window.google.maps.LatLngBounds();
        newMarkers.forEach((m) => bounds.extend(m.marker.getPosition()));
        map.fitBounds(bounds);

        setOptimizing(false);

        // Fetch weather along route
        await fetchRouteWeather(result, optimizedRoute);
      });
    } catch (err) {
      console.error("Optimization error:", err);
      setError("Failed to optimize route. Please try again.");
      setOptimizing(false);
    }
  };

  // ═══════════════════════════════════════════
  //  WEATHER ALONG ROUTE
  // ═══════════════════════════════════════════

  const fetchRouteWeather = async (directionsResult, optimizedRoute) => {
    setLoadingWeather(true);
    clearWeather();

    try {
      const samplePoints = [];
      const legs = directionsResult.routes[0].legs;

      // 1. Add all stop locations
      optimizedRoute.forEach((loc, i) => {
        samplePoints.push({
          lat: loc.lat,
          lng: loc.lng,
          type: "stop",
          name: loc.name,
          index: i,
        });
      });

      // 2. Add midpoints & extra points for long legs
      legs.forEach((leg, i) => {
        const sLat = leg.start_location.lat();
        const sLng = leg.start_location.lng();
        const eLat = leg.end_location.lat();
        const eLng = leg.end_location.lng();
        const dist = haversineKm(
          { lat: sLat, lng: sLng },
          { lat: eLat, lng: eLng },
        );

        // Midpoint
        samplePoints.push({
          lat: (sLat + eLat) / 2,
          lng: (sLng + eLng) / 2,
          type: "route",
          name: `Between stop ${i + 1} and ${i + 2}`,
        });

        // Extra sample points for legs > 50km
        if (dist > 50) {
          samplePoints.push({
            lat: sLat + (eLat - sLat) * 0.25,
            lng: sLng + (eLng - sLng) * 0.25,
            type: "route",
            name: `Near stop ${i + 1}`,
          });
          samplePoints.push({
            lat: sLat + (eLat - sLat) * 0.75,
            lng: sLng + (eLng - sLng) * 0.75,
            type: "route",
            name: `Near stop ${i + 2}`,
          });
        }
      });

      // Cap sample count to avoid API overload
      const capped = samplePoints.slice(0, 25);

      // Fetch weather for all sample points in parallel (Open-Meteo — free, no key)
      const weatherPromises = capped.map(async (point) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(4)}&longitude=${point.lng.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,rain,precipitation`,
          );
          const data = await res.json();
          const current = data.current;
          const info = getWeatherInfo(current.weather_code);

          return {
            ...point,
            temperature: current.temperature_2m,
            weatherCode: current.weather_code,
            rain: current.rain || 0,
            precipitation: current.precipitation || 0,
            windSpeed: current.wind_speed_10m,
            ...info,
          };
        } catch {
          return {
            ...point,
            condition: "Unknown",
            icon: "cloud",
            color: "#6B7280",
            severity: 0,
            rain: 0,
          };
        }
      });

      const results = await Promise.all(weatherPromises);
      setWeatherData(results);

      // Draw map circles for precipitation areas
      const circles = [];
      results.forEach((point) => {
        if (point.severity >= 2) {
          const radius =
            point.severity >= 5
              ? 10000
              : point.severity >= 4
                ? 8000
                : point.severity >= 3
                  ? 6000
                  : 4000;

          const circle = new window.google.maps.Circle({
            strokeColor: point.color || "#3B82F6",
            strokeOpacity: 0.6,
            strokeWeight: 1.5,
            fillColor: point.color || "#3B82F6",
            fillOpacity: 0.18,
            map: showWeatherLayer ? map : null,
            center: { lat: point.lat, lng: point.lng },
            radius,
          });
          circles.push(circle);
        }
      });

      setWeatherCircles(circles);
    } catch (err) {
      console.error("Weather fetch error:", err);
    } finally {
      setLoadingWeather(false);
    }
  };

  const clearWeather = () => {
    weatherCircles.forEach((c) => c.setMap(null));
    setWeatherCircles([]);
    setWeatherData([]);
  };

  // ═══════════════════════════════════════════
  //  IMPORT FROM SHIPMENTS
  // ═══════════════════════════════════════════

  const loadShipments = async () => {
    setLoadingShipments(true);
    try {
      const res = await getShipments();
      const active = res.data.filter(
        (s) => s.status === "In Transit" || s.status === "Pending",
      );
      setShipments(active);
    } catch (err) {
      console.error("Failed to load shipments", err);
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoadingShipments(false);
    }
  };

  const importShipmentAddress = (address) => {
    if (!map || markersRef.current.length >= locationCount) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        addMarkerAndLocation(loc.lat(), loc.lng(), address, map);
        map.setCenter(loc);
        map.setZoom(12);
      } else {
        alert(`Could not find location: ${address}`);
      }
    });
  };

  // ═══════════════════════════════════════════
  //  SETUP / RESET / SHARING
  // ═══════════════════════════════════════════

  const setupLocations = () => {
    if (!locationCount || locationCount < 2) {
      alert("Minimum 2 locations required");
      return;
    }
    markers.forEach((m) => {
      if (m.marker) m.marker.setMap(null);
    });
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    clearWeather();
    setMarkers([]);
    setShowMap(true);
    setRouteResults(null);
  };

  const resetAll = () => {
    markers.forEach((m) => {
      if (m.marker) m.marker.setMap(null);
    });
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    clearWeather();
    setMarkers([]);
    setRouteResults(null);
    setShowMap(false);
    setError(null);
  };

  const copyLink = async () => {
    if (!routeResults?.googleMapsUrl) return;
    try {
      await navigator.clipboard.writeText(routeResults.googleMapsUrl);
    } catch {
      const input = document.createElement("input");
      input.value = routeResults.googleMapsUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToWhatsApp = () => {
    if (!whatsappNumber || !routeResults?.googleMapsUrl) return;
    const clean = whatsappNumber.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `🚚 Optimized delivery route:\n${routeResults.googleMapsUrl}\n\nTotal: ${formatDuration(routeResults.totalDuration)} | ${formatDistance(routeResults.totalDistance)}`,
    );
    window.open(
      `https://api.whatsapp.com/send?phone=${clean}&text=${msg}`,
      "_blank",
    );
  };

  // ── Derived data ──
  const rainPoints = weatherData.filter((w) => w.severity >= 2);
  const stormPoints = weatherData.filter((w) => w.severity >= 4);

  // ═══════════════════════════════════════════
  //  RENDERi
  // ═══════════════════════════════════════════

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══ HEADER ═══ */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#FFC000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFC000]/20">
                <Route className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Route Optimizer
              </h1>
            </div>
            <p className="text-gray-400 font-medium">
              Calculate the shortest delivery route with live weather &amp;
              traffic awareness
            </p>
          </div>
          {showMap && (
            <button
              onClick={resetAll}
              className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-[#FFC000]" />
              Start Over
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!showMap ? (
          /* ═══════════════════════════════════════════
             SETUP SCREEN
             ═══════════════════════════════════════════ */
          <div className="max-w-xl mx-auto">
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-[#FFC000]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-[#FFC000]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Plan Your Route
                </h2>
                <p className="text-gray-400">
                  Set up delivery locations, prioritize urgent stops, and
                  optimize your route to minimize distance and avoid bad
                  weather.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Number of Delivery Stops
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={locationCount}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 2 && v <= 10) setLocationCount(v);
                    }}
                    className="w-full px-4 py-3 bg-black border border-[#333333] rounded-xl text-white focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] text-center text-xl font-bold"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Between 2 and 10 locations
                  </p>
                </div>

                <button
                  onClick={setupLocations}
                  disabled={isLoading}
                  className="w-full px-8 py-4 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-lg rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FFC000]/20 hover:shadow-[#FFC000]/40 transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {isLoading ? "Loading Maps..." : "Start Planning"}
                  {!isLoading && (
                    <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                {
                  icon: <Navigation className="w-5 h-5" />,
                  title: "Shortest Path",
                  desc: "Google Maps optimized",
                },
                {
                  icon: <CloudRain className="w-5 h-5" />,
                  title: "Live Weather",
                  desc: "Rain & storm alerts",
                },
                {
                  icon: <AlertTriangle className="w-5 h-5" />,
                  title: "Priority Mode",
                  desc: "Urgent stops first",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="bg-[#1A1A1A] rounded-xl border border-[#333333] p-4 text-center"
                >
                  <div className="w-10 h-10 bg-[#FFC000]/10 rounded-lg flex items-center justify-center mx-auto mb-2 text-[#FFC000]">
                    {f.icon}
                  </div>
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════
             MAP & ROUTE PLANNING
             ═══════════════════════════════════════════ */
          <div className="space-y-6">
            {/* ── Controls Bar ── */}
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search for a location or click on the map..."
                      className="w-full pl-10 pr-4 py-3 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] font-medium"
                    />
                  </div>
                </div>

                {/* Location counter + Toggles */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-2 bg-black rounded-lg border border-[#333333] text-sm font-bold text-gray-400">
                    <span className="text-[#FFC000]">{markers.length}</span>/
                    {locationCount}
                  </span>

                  {/* Traffic Toggle */}
                  <button
                    onClick={() => setShowTraffic(!showTraffic)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      showTraffic
                        ? "bg-[#FFC000]/10 text-[#FFC000] border-[#FFC000]/30"
                        : "bg-black text-gray-400 border-[#333333] hover:border-gray-500"
                    }`}
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    Traffic
                  </button>

                  {/* Weather Toggle */}
                  <button
                    onClick={() => setShowWeatherLayer(!showWeatherLayer)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      showWeatherLayer
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-black text-gray-400 border-[#333333] hover:border-gray-500"
                    }`}
                  >
                    <CloudRain className="w-3.5 h-3.5" />
                    Weather
                  </button>

                  {/* Priority Mode Toggle */}
                  <button
                    onClick={() => setPriorityMode(!priorityMode)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      priorityMode
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "bg-black text-gray-400 border-[#333333] hover:border-gray-500"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Priority First
                  </button>

                  {/* Import Shipments */}
                  <button
                    onClick={() => {
                      setShowImport(!showImport);
                      if (!showImport) loadShipments();
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-black text-gray-400 border border-[#333333] hover:border-[#FFC000] hover:text-[#FFC000] transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Import
                  </button>
                </div>
              </div>

              {/* Import Panel */}
              {showImport && (
                <div className="mt-4 pt-4 border-t border-[#333333]">
                  <h3 className="text-sm font-bold text-white mb-3">
                    Import from Active Shipments
                  </h3>
                  {loadingShipments ? (
                    <p className="text-gray-400 text-sm flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading
                      shipments...
                    </p>
                  ) : shipments.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      No active shipments found.
                    </p>
                  ) : (
                    <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                      {shipments.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 bg-black rounded-lg border border-[#333333]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {s.delivery_address}
                            </p>
                            <p className="text-xs text-gray-500">
                              {s.tracking_number} &bull; {s.receiver_name}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              importShipmentAddress(s.delivery_address)
                            }
                            disabled={markers.length >= locationCount}
                            className="ml-3 px-3 py-1.5 bg-[#FFC000] text-black text-xs font-bold rounded-lg hover:bg-[#E5AC00] disabled:opacity-50 flex-shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Map ── */}
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
              <div ref={mapRef} className="w-full h-80 lg:h-[500px]" />
              {/* Weather Legend */}
              {weatherData.length > 0 && showWeatherLayer && (
                <div className="p-3 border-t border-[#333333] flex flex-wrap gap-4 text-xs text-gray-400">
                  <span className="font-bold text-gray-500">WEATHER:</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] inline-block"></span>{" "}
                    Clear
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#93C5FD] inline-block"></span>{" "}
                    Drizzle
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] inline-block"></span>{" "}
                    Rain
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] inline-block"></span>{" "}
                    Heavy Rain
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] inline-block"></span>{" "}
                    Storm
                  </span>
                </div>
              )}
            </div>

            {/* ── Locations Table ── */}
            {markers.length > 0 && (
              <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
                <div className="p-4 border-b border-[#333333] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">
                    Delivery Stops
                  </h2>
                  {priorityMode && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                      Priority Mode Active
                    </span>
                  )}
                </div>
                <div className="divide-y divide-[#333333]">
                  {markers.map((loc, i) => (
                    <div
                      key={i}
                      className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-black flex-shrink-0 ${
                          loc.priority === "urgent"
                            ? "bg-red-500"
                            : loc.priority === "high"
                              ? "bg-orange-500"
                              : loc.priority === "low"
                                ? "bg-gray-500"
                                : "bg-[#FFC000]"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={loc.name}
                          onChange={(e) => {
                            setMarkers((prev) =>
                              prev.map((m, idx) =>
                                idx === i ? { ...m, name: e.target.value } : m,
                              ),
                            );
                          }}
                          className="w-full bg-transparent text-white text-sm font-medium focus:outline-none focus:bg-black/30 rounded px-2 py-1 -ml-2"
                        />
                      </div>
                      <select
                        value={loc.priority}
                        onChange={(e) => updatePriority(i, e.target.value)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold border bg-black cursor-pointer focus:outline-none ${PRIORITIES[loc.priority].border} ${PRIORITIES[loc.priority].color}`}
                      >
                        {Object.entries(PRIORITIES).map(([key, cfg]) => (
                          <option key={key} value={key}>
                            {cfg.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteLocation(i)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Optimize Button ── */}
            <button
              onClick={optimizeRoute}
              disabled={markers.length < 2 || optimizing}
              className="w-full px-8 py-4 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-lg rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-[#FFC000]/20 hover:shadow-[#FFC000]/40 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {optimizing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> Calculating
                  Route...
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" strokeWidth={2.5} />
                  {priorityMode
                    ? "Optimize (Urgent Stops First)"
                    : "Optimize Shortest Route"}
                </>
              )}
            </button>

            {/* ═══════════════════════════════════════════
                RESULTS
                ═══════════════════════════════════════════ */}
            {routeResults && (
              <div className="space-y-6">
                {/* ── Route Summary ── */}
                <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
                  <div className="p-5 border-b border-[#333333]">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-[#FFC000]" />
                      Optimized Route
                    </h2>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#333333]">
                    <div className="p-5 text-center">
                      <p className="text-2xl font-bold text-[#FFC000]">
                        {formatDuration(routeResults.totalDuration)}
                      </p>
                      <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                        Total Time
                      </p>
                    </div>
                    <div className="p-5 text-center">
                      <p className="text-2xl font-bold text-white">
                        {formatDistance(routeResults.totalDistance)}
                      </p>
                      <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                        Distance
                      </p>
                    </div>
                    <div className="p-5 text-center">
                      <p className="text-2xl font-bold text-white">
                        {routeResults.optimizedRoute.length}
                      </p>
                      <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                        Stops
                      </p>
                    </div>
                    <div className="p-5 text-center">
                      <p
                        className={`text-2xl font-bold ${rainPoints.length > 0 ? "text-blue-400" : "text-green-400"}`}
                      >
                        {rainPoints.length > 0 ? rainPoints.length : "0"}
                      </p>
                      <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                        Rain Areas
                      </p>
                    </div>
                  </div>

                  {/* Leg-by-Leg Details */}
                  <div className="p-5 border-t border-[#333333]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Route Legs
                    </h3>
                    <div className="space-y-2">
                      {routeResults.legs.map((leg, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 bg-black/40 rounded-xl"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                            style={{
                              backgroundColor: getPriorityMarkerColor(
                                routeResults.optimizedRoute[i]?.priority,
                              ),
                            }}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">
                              {
                                routeResults.optimizedRoute[i]?.name?.split(
                                  ",",
                                )[0]
                              }{" "}
                              →{" "}
                              {
                                routeResults.optimizedRoute[i + 1]?.name?.split(
                                  ",",
                                )[0]
                              }
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-white">
                              {leg.duration.text}
                            </p>
                            <p className="text-xs text-gray-500">
                              {leg.distance.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Weather Panel ── */}
                {(weatherData.length > 0 || loadingWeather) && (
                  <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] overflow-hidden">
                    <div className="p-5 border-b border-[#333333] flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <CloudRain className="w-5 h-5 text-blue-400" />
                        Weather Along Route
                      </h2>
                      {loadingWeather && (
                        <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {/* Rain Warnings Banner */}
                    {rainPoints.length > 0 && (
                      <div className="p-4 bg-blue-500/5 border-b border-[#333333]">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-blue-400">
                              Rainfall detected in {rainPoints.length} area
                              {rainPoints.length !== 1 ? "s" : ""} along your
                              route
                            </p>
                            {stormPoints.length > 0 && (
                              <p className="text-xs text-purple-400 mt-1 font-bold">
                                ⚡ {stormPoints.length} severe weather warning
                                {stormPoints.length !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Weather at each stop */}
                    <div className="divide-y divide-[#333333]">
                      {weatherData
                        .filter((w) => w.type === "stop")
                        .map((w, i) => (
                          <div
                            key={i}
                            className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                w.severity >= 4
                                  ? "bg-purple-500/10 text-purple-400"
                                  : w.severity >= 2
                                    ? "bg-blue-500/10 text-blue-400"
                                    : w.severity >= 1
                                      ? "bg-gray-500/10 text-gray-400"
                                      : "bg-green-500/10 text-green-400"
                              }`}
                            >
                              <WeatherIcon icon={w.icon} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                Stop {(w.index ?? i) + 1}:{" "}
                                {w.name?.split(",")[0]}
                              </p>
                              <p
                                className={`text-xs font-bold ${
                                  w.severity >= 4
                                    ? "text-purple-400"
                                    : w.severity >= 2
                                      ? "text-blue-400"
                                      : "text-gray-400"
                                }`}
                              >
                                {w.condition}
                                {w.rain > 0 && ` • ${w.rain}mm/h rain`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-white">
                                {w.temperature != null
                                  ? `${Math.round(w.temperature)}°`
                                  : "--"}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                                <Wind className="w-3 h-3" />
                                {w.windSpeed != null
                                  ? `${Math.round(w.windSpeed)} km/h`
                                  : "--"}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Rain along intermediate route segments */}
                    {weatherData.filter(
                      (w) => w.type === "route" && w.severity >= 2,
                    ).length > 0 && (
                      <div className="p-4 border-t border-[#333333]">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Rain Detected Between Stops
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {weatherData
                            .filter(
                              (w) => w.type === "route" && w.severity >= 2,
                            )
                            .map((w, i) => (
                              <span
                                key={i}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  w.severity >= 4
                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                }`}
                              >
                                <Droplets className="w-3 h-3 inline mr-1" />
                                {w.name} &bull; {w.condition}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Share / Actions ── */}
                <div className="bg-[#1A1A1A] rounded-2xl border border-[#333333] p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white">Share Route</h3>

                  {/* Google Maps Link */}
                  <div className="flex items-center gap-2">
                    <a
                      href={routeResults.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-3 bg-black border border-[#333333] rounded-xl text-sm text-blue-400 hover:text-blue-300 hover:border-blue-500/30 font-medium truncate flex items-center gap-2 transition-all"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      Open in Google Maps
                    </a>
                    <button
                      onClick={copyLink}
                      className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border ${
                        copied
                          ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : "bg-[#FFC000] text-black border-[#FFC000] hover:bg-[#E5AC00]"
                      }`}
                    >
                      {copied ? (
                        <>
                          <CheckCheck className="w-4 h-4" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* WhatsApp Share */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="WhatsApp number (e.g., +94771234567)"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="flex-1 px-4 py-3 bg-black border border-[#333333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 font-medium text-sm"
                    />
                    <button
                      onClick={shareToWhatsApp}
                      disabled={!whatsappNumber}
                      className="px-4 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-500 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>

                  {/* Optimized Order */}
                  <div className="pt-4 border-t border-[#333333]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Optimized Delivery Order
                    </h4>
                    <div className="space-y-1.5">
                      {routeResults.optimizedRoute.map((loc, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                            style={{
                              backgroundColor: getPriorityMarkerColor(
                                loc.priority,
                              ),
                            }}
                          >
                            {i + 1}
                          </div>
                          <p className="text-sm text-gray-300 truncate flex-1">
                            {loc.name}
                          </p>
                          <span
                            className={`text-xs font-bold ${PRIORITIES[loc.priority]?.color || "text-gray-400"}`}
                          >
                            {PRIORITIES[loc.priority]?.label || "Normal"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteOptimizer;
