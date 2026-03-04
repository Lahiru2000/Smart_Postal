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
  RotateCcw,
  Clock,
} from "lucide-react";
import { getShipments } from "../services/api";

// ─── API ────────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  "AIzaSyBb760vN7Xd17NPIE8q_GhpXCLViUJtr8Q";

// ─── PRIORITY CONFIG ────────────────────────────────────────────────────────
const PRIORITIES = {
  urgent: {
    label: "Urgent",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    order: 0,
    score: 100,
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    order: 1,
    score: 70,
  },
  normal: {
    label: "Normal",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    order: 2,
    score: 40,
  },
  low: {
    label: "Low",
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    order: 3,
    score: 10,
  },
};

// ─── WEATHER CODE INTERPRETATION ────────────────────────────────────────────
const getWeatherInfo = (code) => {
  if (code === 0)
    return {
      condition: "Clear Sky",
      icon: "sun",
      color: "#22C55E",
      severity: 0,
      delay: 0,
    };
  if (code <= 3)
    return {
      condition: "Partly Cloudy",
      icon: "cloud",
      color: "#9CA3AF",
      severity: 1,
      delay: 2,
    };
  if (code <= 48)
    return {
      condition: "Foggy",
      icon: "cloud",
      color: "#6B7280",
      severity: 1,
      delay: 10,
    };
  if (code <= 55)
    return {
      condition: "Drizzle",
      icon: "drizzle",
      color: "#93C5FD",
      severity: 2,
      delay: 8,
    };
  if (code <= 57)
    return {
      condition: "Freezing Drizzle",
      icon: "drizzle",
      color: "#60A5FA",
      severity: 3,
      delay: 15,
    };
  if (code <= 65)
    return {
      condition: "Rain",
      icon: "rain",
      color: "#3B82F6",
      severity: 3,
      delay: 18,
    };
  if (code <= 67)
    return {
      condition: "Freezing Rain",
      icon: "rain",
      color: "#2563EB",
      severity: 4,
      delay: 25,
    };
  if (code <= 77)
    return {
      condition: "Snow",
      icon: "snow",
      color: "#E5E7EB",
      severity: 3,
      delay: 20,
    };
  if (code <= 82)
    return {
      condition: "Rain Showers",
      icon: "rain",
      color: "#3B82F6",
      severity: 3,
      delay: 18,
    };
  if (code <= 86)
    return {
      condition: "Snow Showers",
      icon: "snow",
      color: "#E5E7EB",
      severity: 3,
      delay: 20,
    };
  if (code <= 99)
    return {
      condition: "Thunderstorm",
      icon: "storm",
      color: "#8B5CF6",
      severity: 5,
      delay: 35,
    };
  return {
    condition: "Unknown",
    icon: "cloud",
    color: "#6B7280",
    severity: 0,
    delay: 0,
  };
};

// ─── DARK MAP STYLE ──────────────────────────────────────────────────────────
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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
const formatDuration = (sec) => {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const formatDistance = (m) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
const getPriorityMarkerColor = (p) =>
  ({ urgent: "#EF4444", high: "#F97316", normal: "#FFC000", low: "#6B7280" })[
    p
  ] || "#FFC000";

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

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                       ROUTE OPTIMIZER (MAIN)                            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
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

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // ─── GOOGLE MAPS LOADING ────────────────────────────────────────────────
  useEffect(() => {
    if (window.google?.maps) {
      setIsLoading(false);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoading(false);
    script.onerror = () => {
      setError("Failed to load Google Maps. Check your API key.");
      setIsLoading(false);
    };
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (showMap && !isLoading && !map && window.google) initializeMap();
  }, [showMap, isLoading, map]);

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

  useEffect(() => {
    weatherCircles.forEach((c) => c.setMap(showWeatherLayer ? map : null));
  }, [showWeatherLayer, weatherCircles, map]);
  useEffect(
    () => () => {
      weatherCircles.forEach((c) => c.setMap(null));
    },
    [],
  );

  // ─── MAP INIT ──────────────────────────────────────────────────────────
  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;
    try {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 7.8731, lng: 80.7718 },
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

  // ─── LOCATION MANAGEMENT ──────────────────────────────────────────────
  const handlePlacesChanged = (searchBox, currentMap) => {
    const places = searchBox.getPlaces();
    if (!places?.length) return;
    if (markersRef.current.length >= locationCount) {
      alert(`Maximum ${locationCount} locations allowed`);
      if (searchInputRef.current) searchInputRef.current.value = "";
      return;
    }
    const place = places[0];
    const loc = place.geometry.location;
    let name = place.name;
    if (place.formatted_address && place.formatted_address !== place.name)
      name = `${place.name}, ${place.formatted_address}`;
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
    const lat = e.latLng.lat(),
      lng = e.latLng.lng();
    new window.google.maps.Geocoder().geocode(
      { location: { lat, lng } },
      (results, status) => {
        const name =
          status === "OK" && results[0]
            ? results[0].formatted_address
            : `Location ${markersRef.current.length + 1}`;
        addMarkerAndLocation(lat, lng, name, currentMap);
      },
    );
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
      const [newLat, newLng] = [e.latLng.lat(), e.latLng.lng()];
      new window.google.maps.Geocoder().geocode(
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
    const nm = [...markers];
    if (nm[index].marker) nm[index].marker.setMap(null);
    nm.splice(index, 1);
    nm.forEach((m, i) =>
      m.marker.setLabel({
        text: `${i + 1}`,
        color: "#000",
        fontWeight: "bold",
        fontSize: "12px",
      }),
    );
    setMarkers(nm);
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    setRouteResults(null);
    clearWeather();
  };

  const updatePriority = (index, priority) =>
    setMarkers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, priority } : m)),
    );

  // ─── ROUTE OPTIMIZATION ────────────────────────────────────────────────
  const optimizeRoute = async () => {
    if (markers.length < 2) {
      alert("Please add at least 2 locations");
      return;
    }
    setError(null);
    setOptimizing(true);

    try {
      const orderedLocations = markers.map((m) => ({
        name: m.name,
        lat: m.marker.getPosition().lat(),
        lng: m.marker.getPosition().lng(),
        priority: m.priority,
      }));

      const origin = orderedLocations[0];
      const destination = orderedLocations[orderedLocations.length - 1];
      let waypoints = orderedLocations.slice(1, -1);
      let optimizeWaypoints = true;

      // Priority mode: sort urgent first, skip Google reordering
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

        let totalDuration = 0,
          totalDistance = 0;
        result.routes[0].legs.forEach((leg) => {
          totalDuration += leg.duration.value;
          totalDistance += leg.distance.value;
        });

        const waypointOrder = result.routes[0].waypoint_order;
        const optimizedRoute =
          optimizeWaypoints && waypointOrder
            ? [origin, ...waypointOrder.map((i) => waypoints[i]), destination]
            : [origin, ...waypoints, destination];

        const googleMapsUrl = `https://www.google.com/maps/dir/${optimizedRoute.map((l) => `${l.lat},${l.lng}`).join("/")}`;

        setRouteResults({
          totalDuration,
          totalDistance,
          optimizedRoute,
          googleMapsUrl,
          legs: result.routes[0].legs,
        });

        // Re-draw markers with priority colours
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

        const bounds = new window.google.maps.LatLngBounds();
        newMarkers.forEach((m) => bounds.extend(m.marker.getPosition()));
        map.fitBounds(bounds);

        setOptimizing(false);
        await fetchRouteWeather(result, optimizedRoute);
      });
    } catch (err) {
      console.error("Optimization error:", err);
      setError("Failed to optimize route. Please try again.");
      setOptimizing(false);
    }
  };

  // ─── WEATHER ALONG ROUTE ──────────────────────────────────────────────
  const fetchRouteWeather = async (directionsResult, optimizedRoute) => {
    setLoadingWeather(true);
    clearWeather();
    try {
      const samplePoints = [];
      optimizedRoute.forEach((loc, i) =>
        samplePoints.push({
          lat: loc.lat,
          lng: loc.lng,
          type: "stop",
          name: loc.name,
          index: i,
        }),
      );

      directionsResult.routes[0].legs.forEach((leg, i) => {
        const [sLat, sLng] = [
          leg.start_location.lat(),
          leg.start_location.lng(),
        ];
        const [eLat, eLng] = [leg.end_location.lat(), leg.end_location.lng()];
        const dist = haversineKm(
          { lat: sLat, lng: sLng },
          { lat: eLat, lng: eLng },
        );
        samplePoints.push({
          lat: (sLat + eLat) / 2,
          lng: (sLng + eLng) / 2,
          type: "route",
          name: `Between stop ${i + 1} and ${i + 2}`,
        });
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

      const capped = samplePoints.slice(0, 25);
      const results = await Promise.all(
        capped.map(async (point) => {
          try {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(4)}&longitude=${point.lng.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,rain,precipitation`,
            );
            const data = await res.json();
            const c = data.current;
            const info = getWeatherInfo(c.weather_code);
            return {
              ...point,
              temperature: c.temperature_2m,
              weatherCode: c.weather_code,
              rain: c.rain || 0,
              precipitation: c.precipitation || 0,
              windSpeed: c.wind_speed_10m,
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
        }),
      );

      setWeatherData(results);
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
          circles.push(
            new window.google.maps.Circle({
              strokeColor: point.color || "#3B82F6",
              strokeOpacity: 0.6,
              strokeWeight: 1.5,
              fillColor: point.color || "#3B82F6",
              fillOpacity: 0.18,
              map: showWeatherLayer ? map : null,
              center: { lat: point.lat, lng: point.lng },
              radius,
            }),
          );
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

  // ─── IMPORT FROM SHIPMENTS ────────────────────────────────────────────
  const loadShipments = async () => {
    setLoadingShipments(true);
    try {
      const res = await getShipments();
      setShipments(
        res.data.filter(
          (s) => s.status === "In Transit" || s.status === "Pending",
        ),
      );
    } catch (err) {
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoadingShipments(false);
    }
  };

  const importShipmentAddress = (address) => {
    if (!map || markersRef.current.length >= locationCount) return;
    new window.google.maps.Geocoder().geocode(
      { address },
      (results, status) => {
        if (status === "OK" && results[0]) {
          const loc = results[0].geometry.location;
          addMarkerAndLocation(loc.lat(), loc.lng(), address, map);
          map.setCenter(loc);
          map.setZoom(12);
        } else {
          alert(`Could not find location: ${address}`);
        }
      },
    );
  };

  // ─── SETUP / RESET / SHARING ──────────────────────────────────────────
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
      const i = document.createElement("input");
      i.value = routeResults.googleMapsUrl;
      document.body.appendChild(i);
      i.select();
      document.execCommand("copy");
      document.body.removeChild(i);
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

  const rainPoints = weatherData.filter((w) => w.severity >= 2);
  const stormPoints = weatherData.filter((w) => w.severity >= 4);

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── HEADER ── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 bg-[#FFC000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFC000]/20">
                <Route className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Route Optimizer
                </h1>
                <p className="text-gray-400 text-sm font-medium">
                  ML-powered path selection · weather · traffic · urgency
                </p>
              </div>
            </div>
          </div>
          {showMap && (
            <button
              onClick={resetAll}
              className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333] rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-[#FFC000]" /> Start Over
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* ══ SETUP SCREEN ════════════════════════════════════════════════ */}
        {!showMap ? (
          <div className="max-w-xl mx-auto">
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-[#FFC000]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-[#FFC000]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Plan Your Route
                </h2>
                <p className="text-gray-400">
                  Displays the most optimized path based on live weather
                  conditions, real-time traffic, and order urgency — with
                  supervisor review built in.
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
                    className="w-full px-4 py-3 bg-black border border-[#333] rounded-xl text-white focus:outline-none focus:border-[#FFC000] focus:ring-1 focus:ring-[#FFC000] text-center text-xl font-bold"
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

            {/* Feature pills */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                {
                  Icon: CloudRain,
                  label: "Live Weather",
                  color: "text-blue-400",
                },
                {
                  Icon: Gauge,
                  label: "Traffic Aware",
                  color: "text-orange-400",
                },
                {
                  Icon: Navigation,
                  label: "Urgency First",
                  color: "text-red-400",
                },
                { Icon: MapPin, label: "Multi-Stop", color: "text-green-400" },
              ].map(({ Icon, label, color }) => (
                <div
                  key={label}
                  className="bg-[#1A1A1A] rounded-xl border border-[#333] p-3 flex flex-col items-center gap-2 text-center hover:border-[#444] transition-colors"
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-xs text-gray-400 font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ══ MAP SCREEN ═════════════════════════════════════════════════ */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── LEFT PANEL ── */}
            <div className="space-y-4">
              {/* Search */}
              <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">
                    Add Locations
                  </h3>
                  <span className="text-xs text-gray-500">
                    {markers.length}/{locationCount}
                  </span>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for a location..."
                  className="w-full px-4 py-2.5 bg-black border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC000] text-sm"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Or click anywhere on the map
                </p>
              </div>

              {/* Controls */}
              <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-4 space-y-3">
                {[
                  {
                    label: "Live Traffic",
                    sub: null,
                    val: showTraffic,
                    set: setShowTraffic,
                  },
                  {
                    label: "Priority Mode",
                    sub: priorityMode
                      ? "Urgent stops first"
                      : "Google-optimized order",
                    val: priorityMode,
                    set: setPriorityMode,
                  },
                  {
                    label: "Weather Zones",
                    sub: null,
                    val: showWeatherLayer,
                    set: setShowWeatherLayer,
                  },
                ].map(({ label, sub, val, set }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{label}</p>
                      {sub && <p className="text-xs text-gray-500">{sub}</p>}
                    </div>
                    <button
                      onClick={() => set(!val)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${val ? "bg-[#FFC000]" : "bg-[#333]"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${val ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Location list */}
              {markers.length > 0 && (
                <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">Stops</h3>
                    <button
                      onClick={() => {
                        setShowImport(!showImport);
                        if (!shipments.length) loadShipments();
                      }}
                      className="text-xs text-[#FFC000] hover:text-[#E5AC00] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Import
                    </button>
                  </div>

                  {showImport && (
                    <div className="mb-3 p-3 bg-black/40 rounded-xl border border-[#333]">
                      {loadingShipments ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                          Loading shipments...
                        </div>
                      ) : shipments.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          No active shipments found
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {shipments.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                importShipmentAddress(
                                  s.delivery_address || s.address,
                                );
                                setShowImport(false);
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-white/5 rounded-lg text-xs text-gray-300 truncate transition-colors"
                            >
                              {s.delivery_address ||
                                s.address ||
                                `Shipment #${s.id}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {markers.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 bg-black/30 rounded-xl border border-[#2a2a2a]"
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0 mt-0.5"
                          style={{
                            backgroundColor: getPriorityMarkerColor(m.priority),
                          }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate font-medium">
                            {m.name?.split(",")[0]}
                          </p>
                          <select
                            value={m.priority}
                            onChange={(e) => updatePriority(i, e.target.value)}
                            className="mt-1 text-xs bg-transparent border border-[#333] rounded-lg px-2 py-0.5 text-gray-400 focus:outline-none focus:border-[#FFC000]"
                          >
                            {Object.entries(PRIORITIES).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => deleteLocation(i)}
                          className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={optimizeRoute}
                    disabled={optimizing || markers.length < 2}
                    className="w-full mt-4 px-4 py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-[#FFC000]/20"
                  >
                    {optimizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />{" "}
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Route className="w-4 h-4" /> Optimize Route
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ── MAP + RESULTS ── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Map */}
              <div
                ref={mapRef}
                className="w-full rounded-2xl overflow-hidden border border-[#333]"
                style={{ height: "520px" }}
              >
                {isLoading && (
                  <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-[#FFC000] animate-spin mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Loading map...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Results */}
              {routeResults && (
                <div className="space-y-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        Icon: Clock,
                        label: "Est. Duration",
                        value: formatDuration(routeResults.totalDuration),
                        color: "text-[#FFC000]",
                      },
                      {
                        Icon: Navigation,
                        label: "Total Distance",
                        value: formatDistance(routeResults.totalDistance),
                        color: "text-blue-400",
                      },
                      {
                        Icon: MapPin,
                        label: "Total Stops",
                        value: `${routeResults.optimizedRoute.length}`,
                        color: "text-green-400",
                      },
                    ].map(({ Icon, label, value, color }) => (
                      <div
                        key={label}
                        className="bg-[#1A1A1A] rounded-xl border border-[#333] p-4"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${color}`} />
                          <span className="text-xs text-gray-400">{label}</span>
                        </div>
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Weather delay banner */}
                  {rainPoints.length > 0 && (
                    <div
                      className={`p-4 rounded-xl border flex items-start gap-3 ${stormPoints.length > 0 ? "bg-purple-500/5 border-purple-500/20" : "bg-blue-500/5 border-blue-500/20"}`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${stormPoints.length > 0 ? "text-purple-400" : "text-blue-400"}`}
                      />
                      <div>
                        <p
                          className={`text-sm font-bold ${stormPoints.length > 0 ? "text-purple-400" : "text-blue-400"}`}
                        >
                          Weather delay risk: {rainPoints.length} area
                          {rainPoints.length !== 1 ? "s" : ""} with
                          precipitation detected
                        </p>
                        {stormPoints.length > 0 && (
                          <p className="text-xs text-purple-400 mt-0.5">
                            ⚡ {stormPoints.length} severe storm zone
                            {stormPoints.length !== 1 ? "s" : ""} — stop
                            sequence adjusted
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Route optimized to minimize exposure to adverse
                          weather
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Weather panel */}
                  {weatherData.length > 0 && (
                    <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] overflow-hidden">
                      <div className="p-4 flex items-center justify-between border-b border-[#333]">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                          <CloudRain className="w-4 h-4 text-blue-400" />{" "}
                          Weather Along Route
                        </h2>
                        {loadingWeather && (
                          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                        )}
                      </div>
                      <div className="divide-y divide-[#333]">
                        {weatherData
                          .filter((w) => w.type === "stop")
                          .map((w, i) => (
                            <div
                              key={i}
                              className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                            >
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${w.severity >= 4 ? "bg-purple-500/10 text-purple-400" : w.severity >= 2 ? "bg-blue-500/10 text-blue-400" : w.severity >= 1 ? "bg-gray-500/10 text-gray-400" : "bg-green-500/10 text-green-400"}`}
                              >
                                <WeatherIcon icon={w.icon} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  Stop {(w.index ?? i) + 1}:{" "}
                                  {w.name?.split(",")[0]}
                                </p>
                                <p
                                  className={`text-xs font-bold ${w.severity >= 4 ? "text-purple-400" : w.severity >= 2 ? "text-blue-400" : "text-gray-400"}`}
                                >
                                  {w.condition}
                                  {w.rain > 0 && ` · ${w.rain}mm/h rain`}
                                  {w.delay > 0 && (
                                    <span className="ml-1 text-orange-400">
                                      · +{w.delay}min delay risk
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-base font-bold text-white">
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

                      {/* Rain between stops */}
                      {weatherData.filter(
                        (w) => w.type === "route" && w.severity >= 2,
                      ).length > 0 && (
                        <div className="p-4 border-t border-[#333]">
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
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${w.severity >= 4 ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30"}`}
                                >
                                  <Droplets className="w-3 h-3 inline mr-1" />
                                  {w.name} · {w.condition}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Share panel */}
                  <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      Share Route
                    </h3>
                    <div className="flex items-center gap-2">
                      <a
                        href={routeResults.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-3 bg-black border border-[#333] rounded-xl text-sm text-blue-400 hover:text-blue-300 hover:border-blue-500/30 font-medium truncate flex items-center gap-2 transition-all"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" /> Open
                        in Google Maps
                      </a>
                      <button
                        onClick={copyLink}
                        className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border ${copied ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-[#FFC000] text-black border-[#FFC000] hover:bg-[#E5AC00]"}`}
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

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="WhatsApp number (e.g., +94771234567)"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        className="flex-1 px-4 py-3 bg-black border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 font-medium text-sm"
                      />
                      <button
                        onClick={shareToWhatsApp}
                        disabled={!whatsappNumber}
                        className="px-4 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-500 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-4 h-4" /> WhatsApp
                      </button>
                    </div>

                    {/* Optimized order */}
                    <div className="pt-4 border-t border-[#333]">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteOptimizer;
