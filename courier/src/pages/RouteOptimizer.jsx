import React, { useState, useRef, useEffect, useCallback } from "react";
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
  // ── New feature imports ──
  Play,
  CheckCircle,
  XCircle,
  Radio,
  Repeat,
  UserCheck,
  Users,
  ArrowLeftRight,
  SkipForward,
  Car,
  Construction,
  LogIn,
  PhoneForwarded,
  Siren,
  Timer,
  TrendingUp,
  ShieldAlert,
  ListChecks,
  Milestone,
} from "lucide-react";
import {
  getShipments,
  updatePostmanLocation,
  getNearbyPostmen,
  startDeliverySession,
  getMyActiveSession,
  completeStop,
  endDeliverySession,
  reportDisruption as apiReportDisruption,
  getSessionDisruptions,
  createRedirection as apiCreateRedirection,
  getSessionRedirections,
  updateStopPriority, // NEW: Priority update API
} from "../services/api";

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
    color: "text-blue-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    order: 1,
    score: 70,
  },
  normal: {
    label: "Normal",
    color: "text-yellow-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    order: 2,
    score: 40,
  },
  low: {
    label: "Low",
    color: "text-purple-400",
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
  ({ urgent: "#EF4444", high: "#0f86e7", normal: "#FFC000", low: "#e10afd" })[
    p
  ] || "#FFC000";

// ─── NATIVE MAPS NAVIGATION ──────────────────────────────────────────────────
// Opens the Google Maps app natively on Android/iOS; falls back to web.
// Accepts a stop object with { lat, lng, name }.
const openNativeNavigation = (stop) => {
  if (!stop) return;
  const { lat, lng, name } = stop;
  const encodedAddr = encodeURIComponent(name || `${lat},${lng}`);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isAndroid) {
    // Intent URL — opens Google Maps app directly; browser fallback if not installed
    window.location.href = `intent://maps.google.com/maps?daddr=${lat},${lng}&dirflg=d#Intent;scheme=https;package=com.google.android.apps.maps;end`;
  } else if (isIOS) {
    // Try comgooglemaps scheme; fall back to Apple Maps universal URL after 500 ms
    const nativeUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
    const fallbackUrl = `https://maps.google.com/maps?daddr=${lat},${lng}&dirflg=d`;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = nativeUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
      window.open(fallbackUrl, "_blank");
    }, 500);
  } else {
    // Desktop — open Google Maps in a new tab
    window.open(
      `https://maps.google.com/maps?daddr=${lat},${lng}&dirflg=d`,
      "_blank",
    );
  }
};

// Build a multi-stop Google Maps URL for the full remaining route — kept for share/export use
const buildFullRouteUrl = (optimizedRoute, completedStops, currentStopIdx) => {
  const remaining = optimizedRoute.filter(
    (_, i) => !completedStops.has(i) && i >= currentStopIdx,
  );
  if (!remaining.length) return null;
  return (
    "https://www.google.com/maps/dir/" +
    remaining.map((s) => `${s.lat},${s.lng}`).join("/")
  );
};

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
  const [baseRouteMetrics, setBaseRouteMetrics] = useState(null);
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

  // ── Feature: Real-time Traffic Integration ──
  const [trafficRefreshing, setTrafficRefreshing] = useState(false);
  const [trafficLegs, setTrafficLegs] = useState([]);
  const [lastTrafficRefresh, setLastTrafficRefresh] = useState(null);
  const [showTrafficPanel, setShowTrafficPanel] = useState(false);

  // ── Feature: Dynamic Re-routing ──
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [showDeliverySuccess, setShowDeliverySuccess] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  const [completedStops, setCompletedStops] = useState(new Set());
  const [disruptions, setDisruptions] = useState([]);
  const [showDisruptionModal, setShowDisruptionModal] = useState(false);
  const [disruptionTarget, setDisruptionTarget] = useState(null);
  const [rerouteLoading, setRerouteLoading] = useState(false);
  const [rerouteResult, setRerouteResult] = useState(null);

  // ── Feature: Inter-Postman Redirection ──
  const [redirections, setRedirections] = useState([]);
  const [showRedirectPanel, setShowRedirectPanel] = useState(null);
  const [nearbyPostmen, setNearbyPostmen] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [redirectionLog, setRedirectionLog] = useState([]);
  const [showRedirectionLog, setShowRedirectionLog] = useState(false);

  // ── Feature: Dynamic Priority Updates ──
  const [priorityUpdateMode, setPriorityUpdateMode] = useState(false);
  const [priorityPreview, setPriorityPreview] = useState(null); // { stopIndex, newPriority, beforeDuration, beforeDistance, afterDuration, afterDistance, calculating }

  // ── Feature: Recipient Relocation Re-routing ──
  const [showRelocationModal, setShowRelocationModal] = useState(false);
  const [relocationTarget, setRelocationTarget] = useState(null); // stop index
  const [relocationStep, setRelocationStep] = useState("input"); // 'input' | 'decision'
  const [newRelocationAddress, setNewRelocationAddress] = useState(null); // { lat, lng, name }
  const [detourInfo, setDetourInfo] = useState(null); // { distanceKm, canSelfHandle }
  const [relocationEvents, setRelocationEvents] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [rerouteTrigger, setRerouteTrigger] = useState(0);
  const [startMarker, setStartMarker] = useState(null);

  // ── Feature: Auto Client Location Change Detection ──
  const [autoRelocationAlerts, setAutoRelocationAlerts] = useState([]);

  // ── Refs ──
  const mapRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const trafficIntervalRef = useRef(null);
  const searchInputRef = useRef(null);
  const startPointRef = useRef(null);
  const markersRef = useRef([]);
  const completedMarkersRef = useRef([]); // green ✓ pins — never wiped by reroute
  const polylineRefs = useRef([]);
  const startConnectorRef = useRef(null);
  const relocationInputRef = useRef(null);
  // ── Dynamic rerouting refs ──
  const rerouteDebounceRef = useRef(null); // prevents rapid-fire reroute calls
  const rerouteHistoryRef = useRef([]); // audit trail: [{timestamp, reason, savings}]
  const currentGpsRef = useRef(null); // latest GPS coords for origin snapping
  const clientSnapshotRef = useRef({}); // last-known stop coords { [idx]: { lat, lng } }
  const clientPollRef = useRef(null); // setInterval handle for client-location polling

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // ─── RELOCATION ADDRESS AUTOCOMPLETE ────────────────────────────────────
  useEffect(() => {
    if (!showRelocationModal || relocationStep !== "input" || !window.google)
      return;
    const timer = setTimeout(() => {
      if (!relocationInputRef.current) return;
      const ac = new window.google.maps.places.Autocomplete(
        relocationInputRef.current,
        { types: ["geocode"] },
      );
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry) return;
        const loc = place.geometry.location;
        let name = place.name || "";
        if (place.formatted_address && place.formatted_address !== place.name)
          name = `${place.name}, ${place.formatted_address}`;
        setNewRelocationAddress({ lat: loc.lat(), lng: loc.lng(), name });
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [showRelocationModal, relocationStep]);

  // ─── GPS BROADCASTING ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        // ── Keep latest position in ref so rerouting can snap to it ──
        currentGpsRef.current = { lat: latitude, lng: longitude };
        updatePostmanLocation({
          lat: latitude,
          lng: longitude,
          accuracy_m: accuracy,
          heading: heading ?? undefined,
          speed_kmh: speed != null ? speed * 3.6 : undefined,
          is_available: !deliveryMode,
        }).catch(() => {});
      },
      (err) => console.warn("GPS error:", err.message),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => {
      if (gpsWatchRef.current != null)
        navigator.geolocation.clearWatch(gpsWatchRef.current);
    };
  }, [deliveryMode]);

  // ─── AUTO TRAFFIC REFRESH DURING DELIVERY ──────────────────────────────
  useEffect(() => {
    if (deliveryMode && routeResults) {
      trafficIntervalRef.current = setInterval(
        refreshTrafficData,
        5 * 60 * 1000,
      );
    } else {
      clearInterval(trafficIntervalRef.current);
    }
    return () => clearInterval(trafficIntervalRef.current);
  }, [deliveryMode, routeResults]);

  // ─── CLIENT LOCATION CHANGE POLLING ────────────────────────────────────
  // Every 15 s during an active delivery session, re-fetch shipments and
  // compare each stop's coordinates. If the backend reports a new delivery
  // lat/lng for a shipment (because the recipient updated their location),
  // we automatically move the map marker and re-optimise the route — no
  // manual input from the postman required.
  useEffect(() => {
    if (!deliveryMode || !routeResults?.optimizedRoute) {
      clearInterval(clientPollRef.current);
      return;
    }

    // Initialise snapshot so the first poll has a baseline to compare against
    routeResults.optimizedRoute.forEach((stop, idx) => {
      if (!clientSnapshotRef.current[idx]) {
        clientSnapshotRef.current[idx] = { lat: stop.lat, lng: stop.lng };
      }
    });

    const poll = async () => {
      try {
        const { data: shipments } = await getShipments();
        if (!Array.isArray(shipments) || !shipments.length) return;

        // Access the most up-to-date route via the ref so the closure never
        // captures a stale copy of optimizedRoute.
        const currentRoute = routeResults?.optimizedRoute ?? [];

        currentRoute.forEach((stop, idx) => {
          if (completedStops.has(idx)) return; // already delivered — skip

          // Try to match shipment by id stored on the stop object, or fall
          // back to a name/address substring match.
          const match = shipments.find(
            (s) =>
              (stop.shipmentId &&
                (s.id === stop.shipmentId ||
                  s.shipmentId === stop.shipmentId)) ||
              (s.recipient_name &&
                stop.name
                  ?.toLowerCase()
                  .includes(s.recipient_name.toLowerCase())) ||
              (s.delivery_address &&
                stop.name
                  ?.toLowerCase()
                  .includes(
                    (s.delivery_address || "").toLowerCase().slice(0, 20),
                  )),
          );

          if (!match) return;

          // Pull new coordinates from whichever field the backend uses
          const newLat =
            match.updated_delivery_lat ??
            match.recipient_lat ??
            match.delivery_lat ??
            match.latitude;
          const newLng =
            match.updated_delivery_lng ??
            match.recipient_lng ??
            match.delivery_lng ??
            match.longitude;
          const newName =
            match.updated_delivery_address ??
            match.recipient_address ??
            match.delivery_address ??
            stop.name;

          if (newLat == null || newLng == null) return;

          const distKm = haversineKm(
            { lat: stop.lat, lng: stop.lng },
            { lat: newLat, lng: newLng },
          );

          // Ignore trivial GPS jitter (< 50 m)
          if (distKm < 0.05) return;

          // Avoid re-firing for the same already-processed change
          const snap = clientSnapshotRef.current[idx];
          if (
            snap &&
            Math.abs(snap.lat - newLat) < 0.0001 &&
            Math.abs(snap.lng - newLng) < 0.0001
          )
            return;

          // Record new baseline so we don't process this change again
          clientSnapshotRef.current[idx] = { lat: newLat, lng: newLng };

          // Auto-apply the relocation
          applyAutoRelocation(
            idx,
            { lat: newLat, lng: newLng, name: newName },
            distKm,
          );
        });
      } catch (err) {
        console.warn("Client location poll error:", err);
      }
    };

    clientPollRef.current = setInterval(poll, 15_000);
    return () => clearInterval(clientPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryMode, routeResults, completedStops]);

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

  // ─── START POINT MARKER ON MAP ─────────────────────────────────────────
  useEffect(() => {
    if (!map || !window.google) return;
    // Remove old start marker
    if (startMarker) {
      startMarker.setMap(null);
      setStartMarker(null);
    }
    if (!startPoint) return;
    const marker = new window.google.maps.Marker({
      position: { lat: startPoint.lat, lng: startPoint.lng },
      map,
      title: startPoint.name || "Start Point",
      zIndex: 999,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 16,
        fillColor: "#22C55E",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
      label: {
        text: "S",
        color: "#fff",
        fontWeight: "bold",
        fontSize: "12px",
      },
    });
    const infoWindow = new window.google.maps.InfoWindow({
      content: `<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:bold;border:1px solid #22C55E">${startPoint.name?.split(",")[0] || "Start Point"}</div>`,
    });
    marker.addListener("click", () => infoWindow.open(map, marker));
    setStartMarker(marker);
    map.panTo({ lat: startPoint.lat, lng: startPoint.lng });
  }, [startPoint, map]);

  // ─── CONNECTOR LINE: START POINT → FIRST OPTIMIZED STOP ───────────────
  useEffect(() => {
    // Clear old connector
    if (startConnectorRef.current) {
      startConnectorRef.current.forEach((p) => p.setMap(null));
      startConnectorRef.current = null;
    }
    if (
      !map ||
      !window.google ||
      !startPoint ||
      !routeResults?.optimizedRoute?.length
    )
      return;

    const firstStop = routeResults.optimizedRoute[0];
    const firstStopColor = getPriorityMarkerColor(
      firstStop.priority || "normal",
    );

    const path = [
      { lat: startPoint.lat, lng: startPoint.lng },
      { lat: firstStop.lat, lng: firstStop.lng },
    ];

    // Shadow line
    const shadow = new window.google.maps.Polyline({
      path,
      strokeColor: "#000000",
      strokeWeight: 6,
      strokeOpacity: 0.2,
      map,
      zIndex: 1,
      icons: [],
    });

    // Dashed green line
    const connector = new window.google.maps.Polyline({
      path,
      strokeColor: "#22C55E",
      strokeWeight: 3,
      strokeOpacity: 0,
      map,
      zIndex: 2,
      icons: [
        {
          icon: {
            path: "M 0,-1 0,1",
            strokeOpacity: 1,
            strokeWeight: 3,
            strokeColor: "#22C55E",
            scale: 4,
          },
          offset: "0",
          repeat: "16px",
        },
      ],
    });

    // Arrow at the first stop end (colored by priority)
    const arrow = new window.google.maps.Polyline({
      path,
      strokeColor: firstStopColor,
      strokeWeight: 3,
      strokeOpacity: 0,
      map,
      zIndex: 3,
      icons: [
        {
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: firstStopColor,
            fillColor: firstStopColor,
            fillOpacity: 1,
            strokeOpacity: 1,
          },
          offset: "100%",
        },
      ],
    });

    startConnectorRef.current = [shadow, connector, arrow];
  }, [startPoint, routeResults, map]);

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
        suppressPolylines: true,
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
      if (startPointRef.current) {
        const spBox = new window.google.maps.places.SearchBox(
          startPointRef.current,
        );
        spBox.addListener("places_changed", () => {
          const places = spBox.getPlaces();
          if (!places?.length) return;
          const place = places[0];
          const loc = place.geometry.location;
          let name = place.name;
          if (place.formatted_address && place.formatted_address !== place.name)
            name = `${place.name}, ${place.formatted_address}`;
          setStartPoint({ lat: loc.lat(), lng: loc.lng(), name });
        });
        newMap.addListener("bounds_changed", () =>
          spBox.setBounds(newMap.getBounds()),
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
    clearPriorityPolylines();
    setRouteResults(null);
    clearWeather();
  };

  const updatePriority = (index, priority) =>
    setMarkers((prev) => {
      const updated = prev.map((m, i) =>
        i === index ? { ...m, priority } : m,
      );
      const target = updated[index];
      if (target?.marker && window.google) {
        target.marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: getPriorityMarkerColor(priority),
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
        });
      }
      return updated;
    });

  // ─── PRIORITY + NEAREST-NEIGHBOR SORT (ENHANCED) ──────────────────────────
  // Improvements over original:
  //  1. Weather-severity penalty: stops near storms/heavy rain cost extra km
  //     so the algorithm avoids routing through bad-weather zones unless forced.
  //  2. Traffic-delay penalty: legs already flagged heavy by trafficLegs add
  //     virtual distance so the route avoids them when alternatives exist.
  //  3. Urgency-proximity bonus: an urgent stop within 1 km is always chosen
  //     next regardless of tier ordering, preventing counter-intuitive detours.
  //  4. Same O(n²) complexity — no API calls, runs synchronously.
  const priorityNearestNeighborSort = (
    stops,
    startFrom,
    liveWeather = weatherData,
    liveTrafficLegs = trafficLegs,
  ) => {
    const PRIORITY_ORDER = ["urgent", "high", "normal", "low"];

    // ── Weather penalty: virtual km added for stops near severe weather ──
    const weatherPenaltyKm = (stop) => {
      if (!liveWeather?.length) return 0;
      let maxSeverity = 0;
      liveWeather.forEach((w) => {
        const dist = haversineKm(
          { lat: stop.lat, lng: stop.lng },
          { lat: w.lat, lng: w.lng },
        );
        if (dist < 8) maxSeverity = Math.max(maxSeverity, w.severity || 0);
      });
      // severity 5 (thunderstorm) → +20 km penalty, severity 4 → +12, severity 3 → +6
      if (maxSeverity >= 5) return 20;
      if (maxSeverity >= 4) return 12;
      if (maxSeverity >= 3) return 6;
      return 0;
    };

    // ── Traffic penalty: virtual km for a leg that is currently congested ──
    // liveTrafficLegs[i] covers stop i → stop i+1 in the CURRENT route order.
    // We use stop name matching as a proxy since indices may have shifted.
    const trafficPenaltyKm = (stop) => {
      if (!liveTrafficLegs?.length) return 0;
      const leg = liveTrafficLegs.find((l) =>
        l.end
          ?.toLowerCase()
          .includes(stop.name?.split(",")[0]?.toLowerCase() ?? ""),
      );
      if (!leg) return 0;
      if (leg.congestionLevel === "heavy") return 8;
      if (leg.congestionLevel === "moderate") return 3;
      return 0;
    };

    // Build priority buckets
    const buckets = {};
    PRIORITY_ORDER.forEach((p) => (buckets[p] = []));
    stops.forEach((s) => {
      const tier = PRIORITY_ORDER.includes(s.priority) ? s.priority : "normal";
      buckets[tier].push(s);
    });

    const result = [];
    let cursor = startFrom;

    PRIORITY_ORDER.forEach((tier) => {
      const pool = [...buckets[tier]];
      while (pool.length > 0) {
        // ── Urgency-proximity override: urgent stop within 1 km → pick it first ──
        if (tier === "urgent") {
          const veryCloseIdx = pool.findIndex(
            (s) => haversineKm(cursor, s) <= 1.0,
          );
          if (veryCloseIdx !== -1) {
            const chosen = pool.splice(veryCloseIdx, 1)[0];
            result.push(chosen);
            cursor = chosen;
            continue;
          }
        }

        // ── Composite score: distance + weather penalty + traffic penalty ──
        let bestIdx = 0;
        let bestScore = Infinity;
        pool.forEach((stop, i) => {
          const distKm = haversineKm(cursor, stop);
          const score =
            distKm + weatherPenaltyKm(stop) + trafficPenaltyKm(stop);
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        });

        const chosen = pool.splice(bestIdx, 1)[0];
        result.push(chosen);
        cursor = chosen;
      }
    });

    return result;
  };

  // ─── ROUTE OPTIMIZATION ────────────────────────────────────────────────
  const optimizeRoute = async () => {
    if (markers.length < 2) {
      alert("Please add at least 2 locations");
      return;
    }
    setError(null);
    setOptimizing(true);

    try {
      const allLocations = markers.map((m) => ({
        name: m.name,
        lat: m.marker.getPosition().lat(),
        lng: m.marker.getPosition().lng(),
        priority: m.priority,
      }));

      const directionsService = new window.google.maps.DirectionsService();

      // ── STEP 1: BASE route (original order) ──
      const baseOrigin = allLocations[0];
      const baseDestination = allLocations[allLocations.length - 1];
      const baseWaypoints = allLocations.slice(1, -1);

      const baseRequest = {
        origin: new window.google.maps.LatLng(baseOrigin.lat, baseOrigin.lng),
        destination: new window.google.maps.LatLng(
          baseDestination.lat,
          baseDestination.lng,
        ),
        waypoints: baseWaypoints.map((w) => ({
          location: new window.google.maps.LatLng(w.lat, w.lng),
          stopover: true,
        })),
        optimizeWaypoints: false,
        travelMode: "DRIVING",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess",
        },
      };

      // Calculate base route metrics first
      directionsService.route(baseRequest, async (baseResult, baseStatus) => {
        if (baseStatus !== "OK") {
          setError(
            `Route calculation failed: ${baseStatus}. Try different locations.`,
          );
          setOptimizing(false);
          return;
        }

        let baseTotalDuration = 0,
          baseTotalDistance = 0;
        baseResult.routes[0].legs.forEach((leg) => {
          baseTotalDuration += leg.duration.value;
          baseTotalDistance += leg.distance.value;
        });
        setBaseRouteMetrics({
          totalDuration: baseTotalDuration,
          totalDistance: baseTotalDistance,
        });

        // ── STEP 2: Try PRIORITY-BASED optimization ──
        const startFrom = startPoint || allLocations[0];
        if (!startPoint)
          setStartPoint({
            lat: allLocations[0].lat,
            lng: allLocations[0].lng,
            name: allLocations[0].name,
          });
        const sorted = priorityNearestNeighborSort(allLocations, startFrom);

        const origin = sorted[0];
        const destination = sorted[sorted.length - 1];
        const waypoints = sorted.slice(1, -1);

        const priorityRequest = {
          origin: new window.google.maps.LatLng(origin.lat, origin.lng),
          destination: new window.google.maps.LatLng(
            destination.lat,
            destination.lng,
          ),
          waypoints: waypoints.map((w) => ({
            location: new window.google.maps.LatLng(w.lat, w.lng),
            stopover: true,
          })),
          optimizeWaypoints: false,
          travelMode: "DRIVING",
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: "bestguess",
          },
        };

        directionsService.route(
          priorityRequest,
          async (priorityResult, priorityStatus) => {
            if (priorityStatus !== "OK") {
              setError(
                `Route calculation failed: ${priorityStatus}. Try different locations.`,
              );
              setOptimizing(false);
              return;
            }

            let priorityDuration = 0,
              priorityDistance = 0;
            priorityResult.routes[0].legs.forEach((leg) => {
              priorityDuration += leg.duration.value;
              priorityDistance += leg.distance.value;
            });

            // ── STEP 3: Try GOOGLE'S optimization as fallback ──
            const googleOptRequest = {
              origin: new window.google.maps.LatLng(
                baseOrigin.lat,
                baseOrigin.lng,
              ),
              destination: new window.google.maps.LatLng(
                baseDestination.lat,
                baseDestination.lng,
              ),
              waypoints: baseWaypoints.map((w) => ({
                location: new window.google.maps.LatLng(w.lat, w.lng),
                stopover: true,
              })),
              optimizeWaypoints: true, // Let Google optimize
              travelMode: "DRIVING",
              drivingOptions: {
                departureTime: new Date(),
                trafficModel: "bestguess",
              },
            };

            directionsService.route(
              googleOptRequest,
              async (googleResult, googleStatus) => {
                let googleDuration = Infinity,
                  googleDistance = Infinity,
                  googleOptRoute = null;

                if (googleStatus === "OK") {
                  googleDuration = 0;
                  googleDistance = 0;
                  googleResult.routes[0].legs.forEach((leg) => {
                    googleDuration += leg.duration.value;
                    googleDistance += leg.distance.value;
                  });

                  // Reconstruct route order from Google's optimization
                  const waypointOrder =
                    googleResult.routes[0].waypoint_order || [];
                  googleOptRoute = [
                    allLocations[0], // Origin
                    ...waypointOrder.map((idx) => allLocations[idx + 1]),
                    allLocations[allLocations.length - 1], // Destination
                  ];
                }

                // ── STEP 4: Choose the BEST route (must be better than base) ──
                let finalResult, finalRoute, finalDuration, finalDistance;

                // Compare all options and choose the best one
                const isPriorityBetter =
                  priorityDuration < baseTotalDuration &&
                  priorityDistance < baseTotalDistance;
                const isGoogleBetter =
                  googleDuration < baseTotalDuration &&
                  googleDistance < baseTotalDistance;

                if (
                  isPriorityBetter &&
                  (!isGoogleBetter || priorityDuration <= googleDuration)
                ) {
                  // Priority-based is better
                  finalResult = priorityResult;
                  finalRoute = sorted;
                  finalDuration = priorityDuration;
                  finalDistance = priorityDistance;
                } else if (isGoogleBetter) {
                  // Google's optimization is better
                  finalResult = googleResult;
                  finalRoute = googleOptRoute;
                  finalDuration = googleDuration;
                  finalDistance = googleDistance;
                } else {
                  // Neither improved - keep original order
                  finalResult = baseResult;
                  finalRoute = allLocations;
                  finalDuration = baseTotalDuration;
                  finalDistance = baseTotalDistance;
                }

                // Display the final route
                directionsRenderer.setDirections(finalResult);

                const googleMapsUrl = `https://www.google.com/maps/dir/${finalRoute
                  .map((l) => `${l.lat},${l.lng}`)
                  .join("/")}`;

                setRouteResults({
                  totalDuration: finalDuration,
                  totalDistance: finalDistance,
                  optimizedRoute: finalRoute,
                  googleMapsUrl,
                  legs: finalResult.routes[0].legs,
                });

                drawPriorityPolylines(finalResult, finalRoute);

                markers.forEach((m) => m.marker.setMap(null));
                const newMarkers = finalRoute.map((loc, i) => {
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
                newMarkers.forEach((m) =>
                  bounds.extend(m.marker.getPosition()),
                );
                map.fitBounds(bounds);

                setOptimizing(false);
                await fetchRouteWeather(finalResult, finalRoute);
              },
            );
          },
        );
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

  // ─── PRIORITY-COLOURED ROUTE POLYLINES ───────────────────────────────────
  const clearPriorityPolylines = () => {
    polylineRefs.current.forEach((p) => p.setMap(null));
    polylineRefs.current = [];
  };

  const drawPriorityPolylines = (directionsResult, route) => {
    clearPriorityPolylines();
    if (!map || !window.google) return;

    directionsResult.routes[0].legs.forEach((leg, legIndex) => {
      const destStop = route[legIndex + 1] || route[route.length - 1];
      const priority = destStop?.priority || "normal";
      const color = getPriorityMarkerColor(priority);

      const path = [];
      leg.steps.forEach((step) => {
        (step.path || []).forEach((pt) => path.push(pt));
      });

      [
        { color: "#000000", weight: 8, opacity: 0.25 },
        { color, weight: 5, opacity: 0.9 },
      ].forEach(({ color: c, weight, opacity }) => {
        const pl = new window.google.maps.Polyline({
          path,
          strokeColor: c,
          strokeWeight: weight,
          strokeOpacity: opacity,
          map,
          zIndex: weight,
        });
        polylineRefs.current.push(pl);
      });
    });
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
    clearPriorityPolylines();
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
    clearPriorityPolylines();
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

  // ══════════════════════════════════════════════════════════════════════════
  // ║  FEATURE 1 — REAL-TIME TRAFFIC REFRESH
  // ══════════════════════════════════════════════════════════════════════════
  const refreshTrafficData = async () => {
    if (!routeResults || !window.google) return;
    setTrafficRefreshing(true);
    try {
      const { optimizedRoute } = routeResults;
      const origin = optimizedRoute[0];
      const destination = optimizedRoute[optimizedRoute.length - 1];
      const waypoints = optimizedRoute.slice(1, -1);

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
        optimizeWaypoints: false,
        travelMode: "DRIVING",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess",
        },
      };

      directionsService.route(request, (result, status) => {
        if (status !== "OK") {
          console.error("Traffic refresh failed:", status);
          setTrafficRefreshing(false);
          return;
        }

        const legs = result.routes[0].legs.map((leg) => {
          const baseDuration = leg.duration.value;
          const trafficDuration =
            leg.duration_in_traffic?.value || baseDuration;
          const delaySeconds = Math.max(0, trafficDuration - baseDuration);
          const delayMin = Math.round(delaySeconds / 60);
          const ratio = trafficDuration / (baseDuration || 1);
          const congestionLevel =
            ratio > 1.5 ? "heavy" : ratio > 1.2 ? "moderate" : "light";

          return {
            start: leg.start_address,
            end: leg.end_address,
            duration: baseDuration,
            durationWithTraffic: trafficDuration,
            delayMin,
            congestionLevel,
            distance: leg.distance.value,
          };
        });

        if (directionsRenderer) {
          directionsRenderer.setDirections(result);
          drawPriorityPolylines(result, routeResults.optimizedRoute);
        }

        const totalTrafficDuration = legs.reduce(
          (sum, l) => sum + l.durationWithTraffic,
          0,
        );
        setTrafficLegs(legs);
        setLastTrafficRefresh(new Date());
        setShowTrafficPanel(true);
        setRouteResults((prev) => ({
          ...prev,
          totalDuration: totalTrafficDuration,
          trafficLegs: legs,
        }));
        setTrafficRefreshing(false);
      });
    } catch (err) {
      console.error("Traffic refresh error:", err);
      setTrafficRefreshing(false);
    }
  };

  const getCongestionColor = (level) => {
    if (level === "heavy")
      return {
        text: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
      };
    if (level === "moderate")
      return {
        text: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/30",
      };
    return {
      text: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
    };
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ║  FEATURE 2 — DYNAMIC RE-ROUTING
  // ══════════════════════════════════════════════════════════════════════════
  const startDelivery = async () => {
    if (!routeResults) return;

    let capturedStartPoint = null;
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        capturedStartPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: "Your Location",
        };
        setStartPoint(capturedStartPoint);
      } catch (error) {
        console.warn("Could not get start location:", error);
        capturedStartPoint = {
          lat: routeResults.optimizedRoute[0].lat,
          lng: routeResults.optimizedRoute[0].lng,
          name: "Start Point",
        };
        setStartPoint(capturedStartPoint);
      }
    }

    try {
      const { data } = await startDeliverySession({
        route_data: routeResults.optimizedRoute,
        google_maps_url: routeResults.googleMapsUrl,
        total_distance_m: routeResults.totalDistance,
        total_duration_s: routeResults.totalDuration,
        start_location: capturedStartPoint,
      });
      setSessionId(data.id);
      setDeliveryMode(true);
      setCurrentStopIdx(data.current_stop_idx);
      setCompletedStops(new Set(data.completed_stops));
      setDisruptions([]);
      setRerouteResult(null);
      setRedirectionLog([]);
      fetchNearbyPostmen(routeResults.optimizedRoute);
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Failed to start delivery session. Please try again.");
    }
  };

  const markStopDelivered = async (idx) => {
    if (!sessionId) return;
    try {
      const { data } = await completeStop(sessionId, idx);
      const newCompletedStops = new Set(data.completed_stops);
      const newCurrentStopIdx = data.current_stop_idx;

      setCompletedStops(newCompletedStops);
      setCurrentStopIdx(newCurrentStopIdx);

      // Turn delivered marker green + checkmark, save to completedMarkersRef
      const m = markersRef.current[idx];
      if (m?.marker && window.google) {
        m.marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#22C55E",
          fillOpacity: 1,
          strokeColor: "#1a1a1a",
          strokeWeight: 2,
        });
        m.marker.setLabel({
          text: "✓",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "12px",
        });
        m.marker.setZIndex(5);
        // Park this marker in completedMarkersRef so reroute never removes it
        completedMarkersRef.current.push(m.marker);
      }

      // Clear existing route lines from the map
      clearPriorityPolylines();
      if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

      // ── Check if all stops are done ──
      const totalStops = routeResults?.optimizedRoute?.length ?? 0;
      if (newCompletedStops.size >= totalStops && totalStops > 0) {
        // All delivered — end session and show success
        try {
          await endDeliverySession(sessionId, "completed");
        } catch (_) {}
        setShowDeliverySuccess(true);
        setDeliveryMode(false);
        return;
      }

      // Re-optimise and redraw route for remaining stops only
      // Pass fresh completed/currentIdx so reroute doesn't read stale closure
      if (routeResults?.optimizedRoute) {
        rerouteWithNewPriorities(
          routeResults.optimizedRoute,
          newCompletedStops,
          newCurrentStopIdx,
        );
      }
    } catch (err) {
      console.error("Failed to complete stop:", err);
      setError("Failed to mark stop as delivered. Please retry.");
    }
  };

  // ─── reportDisruption ────────────────────────────────────────────────────
  // FIX 1: Compute `newCurrentStopIdx` synchronously (before any setState call)
  //         so rerouteAroundDisruption receives the correct "from" index rather
  //         than the stale closure value.
  // FIX 2: Immediately grey-out the disrupted stop's map marker so the UI
  //         makes it visually clear that stop has been skipped.
  const reportDisruption = async (stopIndex, type) => {
    if (!sessionId) return;
    setShowDisruptionModal(false);
    setDisruptionTarget(null);

    // ── Compute the next active stop index RIGHT NOW (synchronous) ──
    // setCurrentStopIdx is async; rerouteAroundDisruption runs in the same
    // tick and would read the stale value if we don't pass it explicitly.
    let newCurrentStopIdx = currentStopIdx;
    if (stopIndex === currentStopIdx && routeResults?.optimizedRoute) {
      const totalStops = routeResults.optimizedRoute.length;
      let next = stopIndex + 1;
      while (next < totalStops && completedStops.has(next)) next++;
      if (next < totalStops) {
        newCurrentStopIdx = next;
        setCurrentStopIdx(next);
      }
    }

    // ── Grey-out the disrupted stop marker immediately ──
    const disruptedMarker = markers[stopIndex];
    if (disruptedMarker?.marker && window.google) {
      disruptedMarker.marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#6B7280", // grey = skipped
        fillOpacity: 0.5,
        strokeColor: "#EF4444", // red border = disrupted
        strokeWeight: 2,
      });
    }

    try {
      const { data } = await apiReportDisruption({
        session_id: sessionId,
        stop_index: stopIndex,
        disruption_type: type,
      });
      setDisruptions((prev) => [
        ...prev,
        {
          id: data.id,
          stopIndex: data.stop_index,
          type: data.disruption_type,
          description: data.description,
          timestamp: new Date(data.reported_at),
          status: data.status,
        },
      ]);
      rerouteAroundDisruption(stopIndex, { type }, newCurrentStopIdx);
    } catch (err) {
      console.error("Failed to report disruption:", err);
      setError("Disruption could not be saved. Re-routing locally.");
      rerouteAroundDisruption(stopIndex, { type }, newCurrentStopIdx);
    }
  };

  // ─── rerouteAroundDisruption (ENHANCED) ─────────────────────────────────────
  // Key improvements over original:
  //  1. Re-sorts remaining stops via priorityNearestNeighborSort (weather+traffic
  //     aware) instead of keeping stale original order after a skip.
  //  2. Updates routeResults.optimizedRoute so future reroutes start fresh.
  //  3. Disruption-type avoidance flags:
  //       flooding/snow  → avoidHighways + avoidFerries
  //       closure/accident → try avoidTolls on first attempt; plain retry on fail
  //  4. Retry with simplified request on DirectionsService failure.
  //  5. Saves time/distance delta into rerouteHistoryRef for analytics.
  //  6. Uses live GPS position as origin when available (currentGpsRef).
  const rerouteAroundDisruption = async (
    skippedStopIdx,
    disruption,
    fromIdx = currentStopIdx,
  ) => {
    if (!routeResults || !window.google) return;
    setRerouteLoading(true);

    const { optimizedRoute } = routeResults;

    // ── Build remaining stops, excluding skipped & completed, from fromIdx ──
    const rawRemaining = optimizedRoute.filter(
      (_, i) => i !== skippedStopIdx && !completedStops.has(i) && i >= fromIdx,
    );

    if (rawRemaining.length < 2) {
      clearPriorityPolylines();
      if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
      setRerouteLoading(false);
      return;
    }

    // ── Snap origin to live GPS if available, else first remaining stop ──
    const gpsOrigin = currentGpsRef.current;
    const originStop = gpsOrigin
      ? {
          ...rawRemaining[0],
          lat: gpsOrigin.lat,
          lng: gpsOrigin.lng,
          name: "Your Location",
        }
      : rawRemaining[0];

    // ── Re-sort remaining stops with priority + weather + traffic awareness ──
    // This is the key improvement: instead of keeping the disrupted order,
    // we find the genuinely optimal sequence from the current position.
    const sortedRemaining = priorityNearestNeighborSort(
      rawRemaining,
      originStop,
    );

    const origin = gpsOrigin ? originStop : sortedRemaining[0];
    const destination = sortedRemaining[sortedRemaining.length - 1];
    const waypoints = gpsOrigin
      ? sortedRemaining
      : sortedRemaining.slice(1, -1);

    // ── Disruption-type avoidance flags ──
    const isWeatherDisruption = ["flooding", "snow"].includes(disruption?.type);
    const isRoadDisruption = ["closure", "accident", "construction"].includes(
      disruption?.type,
    );

    const buildRequest = (avoidHighways, avoidTolls) => ({
      origin: new window.google.maps.LatLng(origin.lat, origin.lng),
      destination: new window.google.maps.LatLng(
        destination.lat,
        destination.lng,
      ),
      waypoints: (gpsOrigin
        ? sortedRemaining.slice(0, -1)
        : sortedRemaining.slice(1, -1)
      ).map((w) => ({
        location: new window.google.maps.LatLng(w.lat, w.lng),
        stopover: true,
      })),
      optimizeWaypoints: false,
      travelMode: "DRIVING",
      drivingOptions: { departureTime: new Date(), trafficModel: "bestguess" },
      avoidHighways,
      avoidTolls,
      avoidFerries: isWeatherDisruption,
    });

    const directionsService = new window.google.maps.DirectionsService();

    // ── Attempt reroute with appropriate avoidance flags; retry on failure ──
    const attemptRoute = (request, isRetry = false) => {
      directionsService.route(request, (result, status) => {
        if (status !== "OK") {
          if (!isRetry) {
            // Retry with fewer constraints (remove highway/toll avoidance)
            console.warn(
              `Re-route attempt failed (${status}), retrying without avoidance flags…`,
            );
            attemptRoute(buildRequest(false, false), true);
          } else {
            console.error("Re-route failed on retry:", status);
            setRerouteLoading(false);
          }
          return;
        }

        // ── Draw priority-coloured polylines on the new route ──
        drawPriorityPolylines(result, sortedRemaining);

        // ── Compute new totals (prefer traffic-aware duration) ──
        let rerouteDuration = 0,
          rerouteDistance = 0;
        result.routes[0].legs.forEach((leg) => {
          rerouteDuration +=
            leg.duration_in_traffic?.value || leg.duration.value;
          rerouteDistance += leg.distance.value;
        });

        // ── Compute savings vs. original remaining route ──
        const originalRemaining = optimizedRoute.filter(
          (_, i) =>
            i !== skippedStopIdx && !completedStops.has(i) && i >= fromIdx,
        );
        const originalDuration =
          routeResults.legs
            ?.slice(fromIdx, originalRemaining.length + fromIdx)
            .reduce(
              (s, l) =>
                s + (l.duration_in_traffic?.value || l.duration?.value || 0),
              0,
            ) ?? 0;
        const savedSeconds = Math.max(0, originalDuration - rerouteDuration);

        // ── Rebuild markers: completed=green, skipped=grey+red border, active=priority colour ──
        markers.forEach((m) => m.marker?.setMap(null));

        const remainingSet = new Set(
          sortedRemaining.map((r) => `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`),
        );

        const newMarkers = optimizedRoute.map((loc, originalIdx) => {
          const locKey = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
          const isSkipped = originalIdx === skippedStopIdx;
          const isCompleted = completedStops.has(originalIdx);
          const isActive =
            remainingSet.has(locKey) && !isSkipped && !isCompleted;
          const orderInRemaining = isActive
            ? sortedRemaining.findIndex(
                (r) =>
                  r.lat.toFixed(5) === loc.lat.toFixed(5) &&
                  r.lng.toFixed(5) === loc.lng.toFixed(5),
              ) + 1
            : 0;

          let fillColor, label, opacity, scale;
          if (isCompleted) {
            fillColor = "#22C55E";
            label = "✓";
            opacity = 0.55;
            scale = 13;
          } else if (isSkipped) {
            fillColor = "#6B7280";
            label = "✕";
            opacity = 0.55;
            scale = 12;
          } else if (isActive) {
            fillColor = getPriorityMarkerColor(loc.priority);
            label = String(orderInRemaining);
            opacity = 1;
            scale = 14;
          } else {
            fillColor = "#6B7280";
            label = "-";
            opacity = 0.35;
            scale = 11;
          }

          const marker = new window.google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map,
            label: {
              text: label,
              color: isActive ? "#000" : "#fff",
              fontWeight: "bold",
              fontSize: "11px",
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale,
              fillColor,
              fillOpacity: opacity,
              strokeColor: isSkipped ? "#EF4444" : "#000",
              strokeWeight: 2,
            },
            zIndex: isActive ? 10 : 0,
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

        // ── Fit map to new active route ──
        const bounds = new window.google.maps.LatLngBounds();
        sortedRemaining.forEach((loc) =>
          bounds.extend({ lat: loc.lat, lng: loc.lng }),
        );
        if (gpsOrigin)
          bounds.extend({ lat: gpsOrigin.lat, lng: gpsOrigin.lng });
        map.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });

        // ── Update routeResults so subsequent reroutes see the corrected order ──
        setRouteResults((prev) => ({
          ...prev,
          optimizedRoute: sortedRemaining,
          totalDuration: rerouteDuration,
          totalDistance: rerouteDistance,
          legs: result.routes[0].legs,
        }));

        // ── Update currentStopIdx to first stop in new sorted list ──
        const newFirstIdx = optimizedRoute.findIndex(
          (loc) =>
            loc.lat.toFixed(5) === sortedRemaining[0].lat.toFixed(5) &&
            loc.lng.toFixed(5) === sortedRemaining[0].lng.toFixed(5),
        );
        if (newFirstIdx !== -1) setCurrentStopIdx(newFirstIdx);

        // ── Audit trail ──
        rerouteHistoryRef.current.unshift({
          timestamp: new Date(),
          reason: `Disruption: ${disruption?.type ?? "unknown"} at stop ${skippedStopIdx + 1}`,
          savedSeconds,
          rerouteDuration,
          rerouteDistance,
          stopsReordered: sortedRemaining.length,
        });

        setRerouteResult({
          skippedStop: optimizedRoute[skippedStopIdx],
          newRoute: sortedRemaining,
          rerouteDuration,
          rerouteDistance,
          savedSeconds,
          timestamp: new Date(),
          reordered: true,
        });

        setRerouteLoading(false);
      });
    };

    attemptRoute(buildRequest(isWeatherDisruption, isRoadDisruption));
  };

  const endDelivery = async () => {
    if (sessionId) {
      try {
        await endDeliverySession(sessionId, "abandoned");
      } catch (err) {
        console.error("Failed to end session:", err);
      }
    }
    setDeliveryMode(false);
    setSessionId(null);
    setCurrentStopIdx(0);
    setCompletedStops(new Set());
    setDisruptions([]);
    setRerouteResult(null);
    setShowRedirectPanel(null);
    setRedirectionLog([]);
    setPriorityUpdateMode(false);
    setAutoRelocationAlerts([]);
    clientSnapshotRef.current = {};
    clearInterval(clientPollRef.current);
    completedMarkersRef.current.forEach((m) => m?.setMap(null));
    completedMarkersRef.current = [];
    setStartPoint(null);
    if (startConnectorRef.current) {
      startConnectorRef.current.forEach((p) => p.setMap(null));
      startConnectorRef.current = null;
    }
  };

  // ─── SHOW FULL REMAINING ROUTE ON THE EMBEDDED MAP ───────────────────────
  // Fits the in-app map to all remaining (not-yet-completed) stops and
  // smoothly scrolls the page so the map is fully visible.
  const showFullRouteOnMap = () => {
    if (!map || !routeResults?.optimizedRoute) return;
    const remaining = routeResults.optimizedRoute.filter(
      (_, i) => !completedStops.has(i) && i >= currentStopIdx,
    );
    if (!remaining.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    remaining.forEach((loc) => bounds.extend({ lat: loc.lat, lng: loc.lng }));
    map.fitBounds(bounds, { top: 80, right: 60, bottom: 80, left: 60 });

    // Scroll the map into view smoothly
    if (mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  // ══════════════════════════════════════════════════════════════════════════
  const changePriority = async (stopIndex, newPriority) => {
    if (!sessionId) return;

    // Snapshot current metrics as "Before" so the results panel always shows
    // a meaningful Before → After comparison after the route recalculates.
    if (routeResults) {
      setBaseRouteMetrics({
        totalDuration: routeResults.totalDuration,
        totalDistance: routeResults.totalDistance,
      });
    }

    try {
      const { data } = await updateStopPriority(
        sessionId,
        stopIndex,
        newPriority,
      );

      if (routeResults?.optimizedRoute) {
        const updatedRoute = routeResults.optimizedRoute.map((stop, idx) =>
          idx === stopIndex ? { ...stop, priority: newPriority } : stop,
        );

        setRouteResults((prev) => ({
          ...prev,
          optimizedRoute: updatedRoute,
        }));

        await rerouteWithNewPriorities(updatedRoute);
      }

      console.log(`✅ Priority updated: Stop ${stopIndex} → ${newPriority}`);
    } catch (err) {
      console.error("Failed to update priority:", err);
      setError("Priority update failed. Please try again.");
    }
  };

  const previewPriorityChange = (stopIndex, newPriority) => {
    if (!routeResults?.optimizedRoute || !window.google) return;

    const beforeDuration = routeResults.totalDuration;
    const beforeDistance = routeResults.totalDistance;

    setPriorityPreview({
      stopIndex,
      newPriority,
      beforeDuration,
      beforeDistance,
      afterDuration: null,
      afterDistance: null,
      calculating: true,
    });

    const updatedRoute = routeResults.optimizedRoute.map((stop, idx) =>
      idx === stopIndex ? { ...stop, priority: newPriority } : stop,
    );

    const remaining = updatedRoute.filter(
      (stop, idx) => !completedStops.has(idx) && idx >= currentStopIdx,
    );

    if (remaining.length < 2) {
      setPriorityPreview((prev) => ({
        ...prev,
        calculating: false,
        afterDuration: beforeDuration,
        afterDistance: beforeDistance,
      }));
      return;
    }

    const startFrom = remaining[0];
    const prioritySorted = priorityNearestNeighborSort(remaining, startFrom);
    const origin = prioritySorted[0];
    const destination = prioritySorted[prioritySorted.length - 1];
    const waypoints = prioritySorted.slice(1, -1);

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(
          destination.lat,
          destination.lng,
        ),
        waypoints: waypoints.map((w) => ({
          location: new window.google.maps.LatLng(w.lat, w.lng),
          stopover: true,
        })),
        optimizeWaypoints: false,
        travelMode: "DRIVING",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess",
        },
      },
      (result, status) => {
        if (status === "OK") {
          let newDuration = 0,
            newDistance = 0;
          result.routes[0].legs.forEach((leg) => {
            newDuration += leg.duration_in_traffic?.value || leg.duration.value;
            newDistance += leg.distance.value;
          });
          setPriorityPreview((prev) => ({
            ...prev,
            calculating: false,
            afterDuration: newDuration,
            afterDistance: newDistance,
          }));
        } else {
          setPriorityPreview((prev) => ({ ...prev, calculating: false }));
        }
      },
    );
  };

  // ─── rerouteWithNewPriorities (ENHANCED) ────────────────────────────────────
  // Key improvements over original:
  //  1. Debounced — rapid priority changes wait 400 ms before firing a request,
  //     preventing multiple simultaneous DirectionsService calls.
  //  2. GPS origin snapping — uses live position as the route start if available.
  //  3. Passes live weather + traffic into priorityNearestNeighborSort.
  //  4. Preserves completed (green) and disrupted (grey+red) marker states.
  //  5. Updates currentStopIdx to the new first active stop index.
  //  6. Logs reroute event to rerouteHistoryRef for the analytics panel.
  const rerouteWithNewPriorities = async (
    updatedRoute,
    overrideCompleted,
    overrideCurrentIdx,
  ) => {
    if (!updatedRoute || !window.google) return;

    // ── Use passed-in values (avoids stale closure after setState) ──
    const effectiveCompleted = overrideCompleted ?? completedStops;
    const effectiveCurrentIdx = overrideCurrentIdx ?? currentStopIdx;

    // ── Debounce: cancel any pending reroute call ──
    if (rerouteDebounceRef.current) clearTimeout(rerouteDebounceRef.current);

    rerouteDebounceRef.current = setTimeout(async () => {
      setRerouteLoading(true);

      const remaining = updatedRoute.filter(
        (stop, idx) =>
          !effectiveCompleted.has(idx) && idx >= effectiveCurrentIdx,
      );

      // ── All stops delivered — show success ──
      if (
        remaining.length === 0 ||
        updatedRoute.every((_, i) => effectiveCompleted.has(i))
      ) {
        setRerouteLoading(false);
        clearPriorityPolylines();
        if (directionsRenderer)
          directionsRenderer.setDirections({ routes: [] });
        setShowDeliverySuccess(true);
        return;
      }

      if (remaining.length < 2) {
        setRerouteLoading(false);
        return;
      }

      // ── Snap to live GPS if available ──
      const gpsOrigin = currentGpsRef.current;
      const startFrom = gpsOrigin
        ? {
            ...remaining[0],
            lat: gpsOrigin.lat,
            lng: gpsOrigin.lng,
            name: "Your Location",
          }
        : remaining[0];

      // ── Re-sort with full weather + traffic awareness ──
      const prioritySorted = priorityNearestNeighborSort(remaining, startFrom);

      const origin = gpsOrigin ? startFrom : prioritySorted[0];
      const destination = prioritySorted[prioritySorted.length - 1];
      const midpoints = gpsOrigin
        ? prioritySorted.slice(0, -1)
        : prioritySorted.slice(1, -1);

      const directionsService = new window.google.maps.DirectionsService();
      const request = {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(
          destination.lat,
          destination.lng,
        ),
        waypoints: midpoints.map((w) => ({
          location: new window.google.maps.LatLng(w.lat, w.lng),
          stopover: true,
        })),
        optimizeWaypoints: false,
        travelMode: "DRIVING",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess",
        },
      };

      const handleResult = (result, status) => {
        if (status !== "OK") {
          console.error("Priority re-route failed:", status);
          setError("Failed to recalculate route. Please try manually.");
          setRerouteLoading(false);
          return;
        }

        drawPriorityPolylines(result, prioritySorted);

        let newDuration = 0,
          newDistance = 0;
        result.routes[0].legs.forEach((leg) => {
          newDuration += leg.duration_in_traffic?.value || leg.duration.value;
          newDistance += leg.distance.value;
        });

        // ── Update routeResults with new route order and metrics ──
        setRouteResults((prev) => ({
          ...prev,
          optimizedRoute: prioritySorted,
          totalDuration: newDuration,
          totalDistance: newDistance,
          legs: result.routes[0].legs,
        }));

        // ── Update currentStopIdx to the index of the new first active stop ──
        const newFirstStop = prioritySorted[0];
        const newFirstIdx = updatedRoute.findIndex(
          (s) =>
            s.lat.toFixed(5) === newFirstStop.lat.toFixed(5) &&
            s.lng.toFixed(5) === newFirstStop.lng.toFixed(5),
        );
        if (newFirstIdx !== -1) setCurrentStopIdx(newFirstIdx);

        // ── Rebuild active markers only — completed pins live in completedMarkersRef ──
        // Remove only active markers; green ✓ pins are owned by completedMarkersRef
        // and must never be removed here.
        const completedPinSet = new Set(completedMarkersRef.current);
        markersRef.current.forEach((m) => {
          if (m?.marker && !completedPinSet.has(m.marker)) {
            m.marker.setMap(null);
          }
        });

        const disruptedIndices = new Set(disruptions.map((d) => d.stopIndex));
        const redirectedIndices = new Set(
          redirections
            .filter((r) => r.status === "transferred")
            .map((r) => r.stopIndex),
        );

        const newMarkers = prioritySorted.map((loc, i) => {
          const isDisrupted = disruptedIndices.has(i);
          const isRedirected = redirectedIndices.has(i);

          let fillColor = getPriorityMarkerColor(loc.priority);
          let label = `${i + 1}`;
          let opacity = 1;
          let strokeColor = "#000";
          let scale = 14;

          if (isDisrupted) {
            fillColor = "#6B7280";
            label = "✕";
            opacity = 0.55;
            strokeColor = "#EF4444";
            scale = 12;
          } else if (isRedirected) {
            fillColor = "#A855F7";
            label = "→";
            opacity = 0.85;
          }

          const marker = new window.google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map,
            label: {
              text: label,
              color: isDisrupted ? "#fff" : "#000",
              fontWeight: "bold",
              fontSize: "11px",
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale,
              fillColor,
              fillOpacity: opacity,
              strokeColor,
              strokeWeight: 2,
            },
            zIndex: 10,
          });
          return { marker, ...loc };
        });

        setMarkers(newMarkers);

        // ── Audit trail ──
        rerouteHistoryRef.current.unshift({
          timestamp: new Date(),
          reason: "Priority update re-optimisation",
          rerouteDuration: newDuration,
          rerouteDistance: newDistance,
          stopsReordered: prioritySorted.length,
        });

        console.log(
          "✅ Route re-optimized with priority + weather + traffic awareness",
        );
        setRerouteTrigger((prev) => prev + 1);
        setRerouteLoading(false);
      };

      directionsService.route(request, handleResult);
    }, 400); // 400 ms debounce
  };

  const createStartPointMarker = (startLoc) => {
    if (!map || !startLoc) return null;

    const marker = new window.google.maps.Marker({
      position: { lat: startLoc.lat, lng: startLoc.lng },
      map,
      label: {
        text: "START",
        color: "#FFF",
        fontWeight: "bold",
        fontSize: "11px",
      },
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 18,
        fillColor: "#10B981",
        fillOpacity: 1,
        strokeColor: "#FFF",
        strokeWeight: 3,
      },
      title: "Delivery Start Point",
      zIndex: 1000,
    });

    setStartMarker(marker);
    return marker;
  };

  useEffect(() => {
    if (deliveryMode && startPoint && map && !startMarker) {
      createStartPointMarker(startPoint);
    }
    return () => {
      if (startMarker) {
        startMarker.setMap(null);
        setStartMarker(null);
      }
    };
  }, [deliveryMode, startPoint, map]);

  // ══════════════════════════════════════════════════════════════════════════
  // ║  FEATURE 3 — INTER-POSTMAN REDIRECTION
  // ══════════════════════════════════════════════════════════════════════════
  const fetchNearbyPostmen = async (route) => {
    if (!route?.length) return;
    setLoadingNearby(true);
    const centroid = route.reduce(
      (acc, loc) => ({
        lat: acc.lat + loc.lat / route.length,
        lng: acc.lng + loc.lng / route.length,
      }),
      { lat: 0, lng: 0 },
    );
    try {
      const { data } = await getNearbyPostmen(centroid.lat, centroid.lng, 15);
      setNearbyPostmen(data);
    } catch (err) {
      console.error("Failed to fetch nearby postmen:", err);
      setNearbyPostmen([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  const flagForRedirection = (stopIndex, reason) => {
    setShowRedirectPanel(stopIndex);
    setRedirections((prev) => {
      const exists = prev.find((r) => r.stopIndex === stopIndex);
      if (exists)
        return prev.map((r) =>
          r.stopIndex === stopIndex ? { ...r, reason } : r,
        );
      return [
        ...prev,
        {
          stopIndex,
          reason,
          status: "pending",
          postman: null,
          timestamp: null,
        },
      ];
    });
  };

  const assignRedirection = async (stopIndex, postman) => {
    if (!sessionId) return;
    const stop = routeResults?.optimizedRoute[stopIndex];
    const redirectionReason =
      redirections.find((r) => r.stopIndex === stopIndex)?.reason ||
      "Address issue";
    try {
      const { data } = await apiCreateRedirection({
        session_id: sessionId,
        stop_index: stopIndex,
        stop_name: stop?.name,
        stop_lat: stop?.lat,
        stop_lng: stop?.lng,
        to_postman_id: postman.postman_id,
        reason: redirectionReason,
      });

      const event = {
        id: data.id,
        stopIndex: data.stop_index,
        stopName: data.stop_name,
        reason: data.reason,
        postman: { name: data.to_postman_name, zone: data.to_postman_zone },
        timestamp: new Date(data.created_at),
        status: data.status,
      };

      setRedirections((prev) =>
        prev.map((r) =>
          r.stopIndex === stopIndex
            ? { ...r, postman, status: "transferred", timestamp: new Date() }
            : r,
        ),
      );
      setRedirectionLog((prev) => [event, ...prev]);
      setShowRedirectPanel(null);

      const m = markers[stopIndex];
      if (m?.marker) {
        m.marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#A855F7",
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
        });
      }
    } catch (err) {
      console.error("Failed to create redirection:", err);
      setError("Handoff could not be saved. Please try again.");
    }
  };

  const getStopDeliveryStatus = (idx) => {
    if (completedStops.has(idx)) return "delivered";
    const redir = redirections.find(
      (r) => r.stopIndex === idx && r.status === "transferred",
    );
    if (redir) return "redirected";
    const disrupted = disruptions.find((d) => d.stopIndex === idx);
    if (disrupted) return "disrupted";
    if (deliveryMode && idx === currentStopIdx) return "current";
    if (deliveryMode && idx > currentStopIdx) return "pending";
    return "idle";
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ║  FEATURE 5 — RECIPIENT RELOCATION RE-ROUTING
  // ══════════════════════════════════════════════════════════════════════════

  /** Open the relocation modal for a given stop */
  const openRelocationModal = (stopIndex) => {
    setRelocationTarget(stopIndex);
    setRelocationStep("input");
    setNewRelocationAddress(null);
    setDetourInfo(null);
    setShowRelocationModal(true);
  };

  /** Called after the postman confirms the new address — compute detour distance */
  const calculateRelocationDetour = () => {
    if (!newRelocationAddress || relocationTarget === null || !routeResults)
      return;
    const currentStop = routeResults.optimizedRoute[relocationTarget];
    const distanceKm = haversineKm(
      { lat: currentStop.lat, lng: currentStop.lng },
      { lat: newRelocationAddress.lat, lng: newRelocationAddress.lng },
    );
    // ≤ 2 km → self-handle recommended; > 2 km → transfer recommended
    setDetourInfo({ distanceKm, canSelfHandle: distanceKm <= 2 });
    setRelocationStep("decision");
  };

  /** Customer has moved — update stop in route and re-optimise immediately */
  const confirmSelfHandleRelocation = () => {
    if (!routeResults || relocationTarget === null || !newRelocationAddress)
      return;

    const updatedRoute = routeResults.optimizedRoute.map((stop, idx) =>
      idx === relocationTarget
        ? {
            ...stop,
            name: newRelocationAddress.name,
            lat: newRelocationAddress.lat,
            lng: newRelocationAddress.lng,
          }
        : stop,
    );

    setRouteResults((prev) => ({ ...prev, optimizedRoute: updatedRoute }));

    // Move the map marker to the new position
    const m = markers[relocationTarget];
    if (m?.marker && window.google) {
      m.marker.setPosition({
        lat: newRelocationAddress.lat,
        lng: newRelocationAddress.lng,
      });
      m.marker.setTitle(newRelocationAddress.name);
      // Re-label icon to orange to show it changed
      m.marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#F97316",
        fillOpacity: 1,
        strokeColor: "#000",
        strokeWeight: 2,
      });
    }

    // Log event
    setRelocationEvents((prev) => [
      {
        id: Date.now(),
        stopIndex: relocationTarget,
        oldAddress: routeResults.optimizedRoute[relocationTarget].name,
        newAddress: newRelocationAddress.name,
        detourKm: haversineKm(
          {
            lat: routeResults.optimizedRoute[relocationTarget].lat,
            lng: routeResults.optimizedRoute[relocationTarget].lng,
          },
          { lat: newRelocationAddress.lat, lng: newRelocationAddress.lng },
        ),
        action: "self_handle",
        timestamp: new Date(),
      },
      ...prev,
    ]);

    // Clear old route lines then re-optimise to new location
    clearPriorityPolylines();
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    rerouteWithNewPriorities(updatedRoute);

    setShowRelocationModal(false);
    setRelocationTarget(null);
    setNewRelocationAddress(null);
  };

  /** Postman cannot reach new address — hand off to nearby postman */
  const confirmTransferRelocation = () => {
    if (relocationTarget === null) return;

    // Log event before closing modal
    if (routeResults && newRelocationAddress) {
      setRelocationEvents((prev) => [
        {
          id: Date.now(),
          stopIndex: relocationTarget,
          oldAddress: routeResults.optimizedRoute[relocationTarget].name,
          newAddress: newRelocationAddress.name,
          detourKm: detourInfo?.distanceKm,
          action: "transfer",
          timestamp: new Date(),
        },
        ...prev,
      ]);
    }

    setShowRelocationModal(false);
    // Open the existing inter-postman redirect panel for this stop
    flagForRedirection(relocationTarget, "Recipient relocated");
  };

  /** Dismiss relocation modal with no action */
  const cancelRelocationModal = () => {
    setShowRelocationModal(false);
    setRelocationTarget(null);
    setNewRelocationAddress(null);
    setDetourInfo(null);
    setRelocationStep("input");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ║  FEATURE 5b — AUTO CLIENT-LOCATION CHANGE HANDLER
  // ║  Called by the polling useEffect when the backend signals that a
  // ║  recipient has updated their delivery address.  No modal is shown —
  // ║  the postman receives an in-app alert card and the route re-optimises
  // ║  automatically.
  // ══════════════════════════════════════════════════════════════════════════
  const applyAutoRelocation = useCallback(
    (stopIndex, newLocation, distKm) => {
      if (!routeResults?.optimizedRoute || !window.google) return;

      const oldStop = routeResults.optimizedRoute[stopIndex];

      // 1. Update the route array with the new coordinates
      const updatedRoute = routeResults.optimizedRoute.map((stop, idx) =>
        idx === stopIndex
          ? {
              ...stop,
              name: newLocation.name,
              lat: newLocation.lat,
              lng: newLocation.lng,
            }
          : stop,
      );

      setRouteResults((prev) => ({ ...prev, optimizedRoute: updatedRoute }));

      // 2. Move the existing map marker to the new position and recolour it
      //    orange so the postman can instantly see which pin moved.
      const m = markersRef.current[stopIndex];
      if (m?.marker) {
        m.marker.setPosition({ lat: newLocation.lat, lng: newLocation.lng });
        m.marker.setTitle(newLocation.name);
        m.marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#F97316", // orange — "relocated"
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
        });
        // Pulse the map pan to the new location so the postman notices
        if (map) map.panTo({ lat: newLocation.lat, lng: newLocation.lng });
      }

      // 3. Show a dismissible alert banner in the UI
      const alertId = Date.now();
      setAutoRelocationAlerts(
        (prev) =>
          [
            {
              id: alertId,
              stopIndex,
              stopNum: stopIndex + 1,
              oldAddress: oldStop?.name ?? "—",
              newAddress: newLocation.name,
              distKm,
              canSelfHandle: distKm <= 2,
              timestamp: new Date(),
            },
            ...prev,
          ].slice(0, 5), // keep at most 5 alerts visible
      );

      // 4. Add to the relocation history log
      setRelocationEvents((prev) => [
        {
          id: alertId,
          stopIndex,
          oldAddress: oldStop?.name ?? "—",
          newAddress: newLocation.name,
          detourKm: distKm,
          action: "auto_detected",
          timestamp: new Date(),
        },
        ...prev,
      ]);

      // 5. Snapshot base metrics so the Before/After panel updates correctly
      if (routeResults) {
        setBaseRouteMetrics({
          totalDuration: routeResults.totalDuration,
          totalDistance: routeResults.totalDistance,
        });
      }

      // 6. Re-optimise the full remaining route around the new location
      rerouteWithNewPriorities(updatedRoute);

      console.log(
        `📍 Auto-relocation: stop ${stopIndex + 1} moved ${distKm.toFixed(2)} km → route re-optimised`,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeResults, map, markersRef],
  );

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
                <p className="text-gray-400 text-sm font-medium">ML-powered</p>
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
                {
                  Icon: Repeat,
                  label: "Dynamic Re-route",
                  color: "text-yellow-400",
                },
                {
                  Icon: ArrowLeftRight,
                  label: "Postman Handoff",
                  color: "text-purple-400",
                },
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
              {/* Start Point */}
              <div className="bg-[#1A1A1A] rounded-2xl border border-green-500/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Start Point</h3>
                  {startPoint && (
                    <button
                      onClick={() => setStartPoint(null)}
                      className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {startPoint ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <MapPin className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-white font-medium truncate flex-1">
                      {startPoint.name?.split(",")[0]}
                    </p>
                    <span className="text-xs font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                      SET
                    </span>
                  </div>
                ) : (
                  <input
                    ref={startPointRef}
                    type="text"
                    placeholder="Search start location..."
                    className="w-full px-4 py-2.5 bg-black border border-green-500/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-500 text-sm"
                  />
                )}
              </div>

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
                    set: (newVal) => {
                      setPriorityMode(newVal);
                      if (
                        !newVal &&
                        routeResults &&
                        markers.length >= 2 &&
                        window.google
                      ) {
                        clearPriorityPolylines();
                        setRerouteResult(null);
                        setTrafficLegs([]);
                        setShowTrafficPanel(false);

                        const locs = markers.map((m) => ({
                          name: m.name,
                          lat: m.marker.getPosition().lat(),
                          lng: m.marker.getPosition().lng(),
                          priority: "normal",
                        }));

                        const origin = locs[0];
                        const destination = locs[locs.length - 1];
                        const waypoints = locs.slice(1, -1);

                        const svc = new window.google.maps.DirectionsService();
                        svc.route(
                          {
                            origin: new window.google.maps.LatLng(
                              origin.lat,
                              origin.lng,
                            ),
                            destination: new window.google.maps.LatLng(
                              destination.lat,
                              destination.lng,
                            ),
                            waypoints: waypoints.map((w) => ({
                              location: new window.google.maps.LatLng(
                                w.lat,
                                w.lng,
                              ),
                              stopover: true,
                            })),
                            optimizeWaypoints: true,
                            travelMode: "DRIVING",
                            drivingOptions: {
                              departureTime: new Date(),
                              trafficModel: "bestguess",
                            },
                          },
                          async (result, status) => {
                            if (status !== "OK") return;

                            clearPriorityPolylines();
                            result.routes[0].legs.forEach((leg) => {
                              const path = [];
                              leg.steps.forEach((step) =>
                                (step.path || []).forEach((pt) =>
                                  path.push(pt),
                                ),
                              );
                              [
                                { color: "#000000", weight: 8, opacity: 0.25 },
                                { color: "#FFC000", weight: 5, opacity: 0.9 },
                              ].forEach(({ color, weight, opacity }) => {
                                const pl = new window.google.maps.Polyline({
                                  path,
                                  strokeColor: color,
                                  strokeWeight: weight,
                                  strokeOpacity: opacity,
                                  map,
                                  zIndex: weight,
                                });
                                polylineRefs.current.push(pl);
                              });
                            });

                            let totalDuration = 0,
                              totalDistance = 0;
                            result.routes[0].legs.forEach((leg) => {
                              totalDuration += leg.duration.value;
                              totalDistance += leg.distance.value;
                            });

                            const waypointOrder =
                              result.routes[0].waypoint_order;
                            const optimizedRoute = [
                              origin,
                              ...waypointOrder.map((i) => waypoints[i]),
                              destination,
                            ];

                            markers.forEach((m) => m.marker?.setMap(null));
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
                                  fillColor: "#FFC000",
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
                                priority: "normal",
                              };
                            });
                            setMarkers(newMarkers);

                            const bounds =
                              new window.google.maps.LatLngBounds();
                            newMarkers.forEach((m) =>
                              bounds.extend(m.marker.getPosition()),
                            );
                            map.fitBounds(bounds);

                            const googleMapsUrl = `https://www.google.com/maps/dir/${optimizedRoute.map((l) => `${l.lat},${l.lng}`).join("/")}`;
                            setRouteResults({
                              totalDuration,
                              totalDistance,
                              optimizedRoute,
                              googleMapsUrl,
                              legs: result.routes[0].legs,
                            });

                            clearWeather();
                            await fetchRouteWeather(result, optimizedRoute);
                          },
                        );
                      }
                    },
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

                {/* Traffic Refresh Button */}
                {routeResults && (
                  <div className="pt-2 border-t border-[#2a2a2a]">
                    <button
                      onClick={refreshTrafficData}
                      disabled={trafficRefreshing}
                      className="w-full px-3 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {trafficRefreshing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                          Refreshing Traffic...
                        </>
                      ) : (
                        <>
                          <Car className="w-3.5 h-3.5" /> Refresh Traffic Data
                        </>
                      )}
                    </button>
                    {lastTrafficRefresh && (
                      <p className="text-center text-xs text-gray-600 mt-1.5">
                        Updated {lastTrafficRefresh.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}
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

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {markers.map((m, i) => {
                      const status = getStopDeliveryStatus(i);
                      const isCurrentStop =
                        deliveryMode && i === currentStopIdx;
                      const redir = redirections.find((r) => r.stopIndex === i);
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2 p-2 rounded-xl border transition-all ${
                            isCurrentStop
                              ? "bg-[#FFC000]/5 border-[#FFC000]/40"
                              : status === "delivered"
                                ? "bg-green-500/5 border-green-500/20 opacity-60"
                                : status === "redirected"
                                  ? "bg-purple-500/5 border-purple-500/20 opacity-60"
                                  : status === "disrupted"
                                    ? "bg-red-500/5 border-red-500/20 opacity-60"
                                    : "bg-black/30 border-[#2a2a2a]"
                          }`}
                        >
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0 mt-0.5"
                            style={{
                              backgroundColor: getPriorityMarkerColor(
                                m.priority,
                              ),
                            }}
                          >
                            {status === "delivered"
                              ? "✓"
                              : status === "redirected"
                                ? "↗"
                                : status === "disrupted"
                                  ? "!"
                                  : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate font-medium">
                              {m.name?.split(",")[0]}
                            </p>
                            {/* Status badges */}
                            {status === "current" && (
                              <span className="inline-flex items-center gap-1 text-xs text-[#FFC000] font-bold">
                                <Radio className="w-3 h-3 animate-pulse" />{" "}
                                Active
                              </span>
                            )}
                            {status === "delivered" && (
                              <span className="text-xs text-green-400 font-bold">
                                Delivered
                              </span>
                            )}
                            {status === "redirected" && (
                              <span className="text-xs text-purple-400 font-bold truncate">
                                → {redir?.postman?.name || "Redirected"}
                              </span>
                            )}
                            {status === "disrupted" && (
                              <span className="text-xs text-red-400 font-bold">
                                Disrupted · Skipped
                              </span>
                            )}
                            {!deliveryMode && priorityMode && (
                              <select
                                value={m.priority}
                                onChange={(e) =>
                                  updatePriority(i, e.target.value)
                                }
                                className="mt-1 text-xs bg-transparent border border-[#333] rounded-lg px-2 py-0.5 text-gray-400 focus:outline-none focus:border-[#FFC000]"
                              >
                                {Object.entries(PRIORITIES).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Delivery mode per-stop actions — only for non-current stops */}
                            {deliveryMode &&
                              status !== "delivered" &&
                              status !== "disrupted" &&
                              status !== "redirected" &&
                              !isCurrentStop && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setDisruptionTarget(i);
                                      setShowDisruptionModal(true);
                                    }}
                                    className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-red-500/20 transition-colors"
                                  >
                                    <ShieldAlert className="w-3 h-3" /> Report
                                    Issue
                                  </button>
                                  <button
                                    onClick={() =>
                                      flagForRedirection(i, "Address issue")
                                    }
                                    className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-purple-500/20 transition-colors"
                                  >
                                    <PhoneForwarded className="w-3 h-3" /> Hand
                                    Off
                                  </button>
                                </div>
                              )}
                          </div>
                          {!deliveryMode && (
                            <button
                              onClick={() => deleteLocation(i)}
                              className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={optimizeRoute}
                    disabled={optimizing || markers.length < 2 || deliveryMode}
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

                  {/* Start / End Delivery */}
                  {routeResults && !deliveryMode && (
                    <button
                      onClick={startDelivery}
                      className="w-full mt-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
                    >
                      <Play className="w-4 h-4" /> Start Delivery
                    </button>
                  )}
                  {deliveryMode &&
                    (() => {
                      const currentStop =
                        routeResults?.optimizedRoute?.[currentStopIdx];
                      const totalStops = markers.length;
                      const doneCount = completedStops.size;
                      const progressPct = Math.round(
                        (doneCount / totalStops) * 100,
                      );

                      return (
                        <div className="space-y-2 mt-2">
                          {/* ── CURRENT STOP HERO CARD ── */}
                          {currentStop && (
                            <div className="rounded-xl border border-[#FFC000]/30 bg-[#FFC000]/5 overflow-hidden">
                              {/* Header strip */}
                              <div className="flex items-center justify-between px-3 py-2 border-b border-[#FFC000]/20 bg-[#FFC000]/10">
                                <div className="flex items-center gap-2">
                                  <Radio className="w-3 h-3 text-[#FFC000] animate-pulse" />
                                  <span className="text-xs font-bold text-[#FFC000] uppercase tracking-wide">
                                    Now Delivering
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400 font-medium">
                                  Stop {currentStopIdx + 1} of {totalStops}
                                </span>
                              </div>

                              {/* Stop address */}
                              <div className="px-3 py-2.5">
                                <div className="flex items-start gap-2">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-black"
                                    style={{
                                      backgroundColor: getPriorityMarkerColor(
                                        currentStop.priority,
                                      ),
                                    }}
                                  >
                                    {currentStopIdx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white leading-tight">
                                      {currentStop.name?.split(",")[0]}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                      {currentStop.name
                                        ?.split(",")
                                        .slice(1, 3)
                                        .join(",")
                                        .trim()}
                                    </p>
                                    <span
                                      className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded mt-1 ${PRIORITIES[currentStop.priority]?.bg} ${PRIORITIES[currentStop.priority]?.color} ${PRIORITIES[currentStop.priority]?.border} border`}
                                    >
                                      {PRIORITIES[currentStop.priority]?.label}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action row */}
                              <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                                {/* Mark delivered */}
                                <button
                                  onClick={() =>
                                    markStopDelivered(currentStopIdx)
                                  }
                                  className="flex flex-col items-center gap-1 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-xs font-bold transition-all"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Done
                                </button>
                                {/* Recipient relocated — new address re-route */}
                                <button
                                  onClick={() =>
                                    openRelocationModal(currentStopIdx)
                                  }
                                  className="flex flex-col items-center gap-1 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-xs font-bold transition-all"
                                >
                                  <MapPin className="w-4 h-4" />
                                  Relocated
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ── PROGRESS BAR ── */}
                          <div className="px-3 py-2.5 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-400 font-medium">
                                Session Progress
                              </span>
                              <span className="text-xs font-bold text-white">
                                {doneCount}/{totalStops} stops
                              </span>
                            </div>
                            <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-xs text-gray-600">
                                {progressPct}% complete
                              </span>
                              {redirectionLog.length > 0 && (
                                <span className="text-xs text-purple-400 font-medium">
                                  {redirectionLog.length} handed off
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ── SECONDARY ACTIONS ── */}
                          <button
                            onClick={() => setPriorityUpdateMode(true)}
                            className="w-full px-4 py-2.5 bg-[#FFC000]/10 hover:bg-[#FFC000]/20 border border-[#FFC000]/30 text-[#FFC000] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                          >
                            <TrendingUp className="w-3.5 h-3.5" /> Update Stop
                            Priorities
                          </button>
                          <button
                            onClick={endDelivery}
                            className="w-full px-4 py-2.5 bg-transparent hover:bg-red-500/5 text-red-500 border border-red-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                          >
                            <XCircle className="w-3.5 h-3.5" /> End Session
                          </button>
                        </div>
                      );
                    })()}
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

              {/* Map priority legend strip — only when Priority Mode is on */}
              {showMap && priorityMode && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 bg-[#1A1A1A] border border-[#333] rounded-xl">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider mr-1">
                    Pin Priority:
                  </span>
                  {Object.entries(PRIORITIES).map(([key, p]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full border-2 border-black flex-shrink-0 shadow"
                        style={{ backgroundColor: getPriorityMarkerColor(key) }}
                      />
                      <span className={`text-xs font-bold ${p.color}`}>
                        {p.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {routeResults && (
                <div className="space-y-4">
                  {/* Summary stats with base vs optimized comparison */}
                  {baseRouteMetrics &&
                  (baseRouteMetrics.totalDuration !==
                    routeResults.totalDuration ||
                    baseRouteMetrics.totalDistance !==
                      routeResults.totalDistance) ? (
                    <div className="space-y-3">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <Route className="w-4 h-4 text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-white">
                              Route Optimized Successfully
                            </h3>
                            <p className="text-xs text-green-400">
                              Efficiency improvements below
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-[#FFC000]" />
                            <span className="text-xs text-gray-400">
                              Est. Duration
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-[#333]/50">
                              <span className="text-xs text-gray-500">
                                Before:
                              </span>
                              <span className="text-sm font-medium text-gray-400 line-through">
                                {formatDuration(baseRouteMetrics.totalDuration)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-medium ${routeResults.totalDuration < baseRouteMetrics.totalDuration ? "text-green-400" : routeResults.totalDuration > baseRouteMetrics.totalDuration ? "text-red-400" : "text-gray-400"}`}
                              >
                                After:
                              </span>
                              <span className="text-lg font-bold text-[#FFC000]">
                                {formatDuration(routeResults.totalDuration)}
                              </span>
                            </div>
                            {baseRouteMetrics.totalDuration !==
                              routeResults.totalDuration && (
                              <div
                                className={`flex items-center gap-1.5 pt-1.5 border-t ${baseRouteMetrics.totalDuration > routeResults.totalDuration ? "border-green-500/20" : "border-red-500/20"}`}
                              >
                                <TrendingUp
                                  className={`w-3.5 h-3.5 ${baseRouteMetrics.totalDuration > routeResults.totalDuration ? "text-green-400" : "text-red-400"}`}
                                />
                                <span
                                  className={`text-xs font-bold ${baseRouteMetrics.totalDuration > routeResults.totalDuration ? "text-green-400" : "text-red-400"}`}
                                >
                                  {baseRouteMetrics.totalDuration >
                                  routeResults.totalDuration
                                    ? "Saved "
                                    : "+"}
                                  {formatDuration(
                                    Math.abs(
                                      baseRouteMetrics.totalDuration -
                                        routeResults.totalDuration,
                                    ),
                                  )}{" "}
                                  (
                                  {Math.round(
                                    (Math.abs(
                                      baseRouteMetrics.totalDuration -
                                        routeResults.totalDuration,
                                    ) /
                                      baseRouteMetrics.totalDuration) *
                                      100,
                                  )}
                                  %)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Navigation className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-gray-400">
                              Total Distance
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-[#333]/50">
                              <span className="text-xs text-gray-500">
                                Before:
                              </span>
                              <span className="text-sm font-medium text-gray-400 line-through">
                                {formatDistance(baseRouteMetrics.totalDistance)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-medium ${routeResults.totalDistance < baseRouteMetrics.totalDistance ? "text-green-400" : routeResults.totalDistance > baseRouteMetrics.totalDistance ? "text-red-400" : "text-gray-400"}`}
                              >
                                After:
                              </span>
                              <span className="text-lg font-bold text-blue-400">
                                {formatDistance(routeResults.totalDistance)}
                              </span>
                            </div>
                            {baseRouteMetrics.totalDistance !==
                              routeResults.totalDistance && (
                              <div
                                className={`flex items-center gap-1.5 pt-1.5 border-t ${baseRouteMetrics.totalDistance > routeResults.totalDistance ? "border-green-500/20" : "border-red-500/20"}`}
                              >
                                <TrendingUp
                                  className={`w-3.5 h-3.5 ${baseRouteMetrics.totalDistance > routeResults.totalDistance ? "text-green-400" : "text-red-400"}`}
                                />
                                <span
                                  className={`text-xs font-bold ${baseRouteMetrics.totalDistance > routeResults.totalDistance ? "text-green-400" : "text-red-400"}`}
                                >
                                  {baseRouteMetrics.totalDistance >
                                  routeResults.totalDistance
                                    ? "Saved "
                                    : "+"}
                                  {formatDistance(
                                    Math.abs(
                                      baseRouteMetrics.totalDistance -
                                        routeResults.totalDistance,
                                    ),
                                  )}{" "}
                                  (
                                  {Math.round(
                                    (Math.abs(
                                      baseRouteMetrics.totalDistance -
                                        routeResults.totalDistance,
                                    ) /
                                      baseRouteMetrics.totalDistance) *
                                      100,
                                  )}
                                  %)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-gray-400">
                            Total Stops
                          </span>
                        </div>
                        <p className="text-xl font-bold text-green-400">
                          {routeResults.optimizedRoute.length}
                        </p>
                      </div>
                    </div>
                  ) : (
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
                            <span className="text-xs text-gray-400">
                              {label}
                            </span>
                          </div>
                          <p className={`text-xl font-bold ${color}`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Route Re-optimization Banner */}
                  {rerouteTrigger > 0 && deliveryMode && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white font-bold">
                          Route Re-optimized
                        </p>
                        <p className="text-xs text-gray-400">
                          Priorities updated • New ETA calculated
                        </p>
                      </div>
                      <button
                        onClick={() => setRerouteTrigger(0)}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {/* ── AUTO CLIENT RELOCATION ALERTS ── */}
                  {autoRelocationAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 bg-orange-500/10 border border-orange-500/40 rounded-xl"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-orange-300">
                              Client Relocated — Stop {alert.stopNum}
                            </p>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                alert.canSelfHandle
                                  ? "bg-green-500/15 text-green-400 border border-green-500/30"
                                  : "bg-red-500/15 text-red-400 border border-red-500/30"
                              }`}
                            >
                              {alert.distKm.toFixed(2)} km away
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            <span className="line-through text-gray-600">
                              {alert.oldAddress?.split(",")[0]}
                            </span>
                            {" → "}
                            <span className="text-white font-medium">
                              {alert.newAddress?.split(",")[0]}
                            </span>
                          </p>
                          <p className="text-xs text-orange-400 font-medium mt-1.5 flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3" />
                            Route automatically re-optimised to new location
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setAutoRelocationAlerts((prev) =>
                              prev.filter((a) => a.id !== alert.id),
                            )
                          }
                          className="text-gray-600 hover:text-white transition-colors flex-shrink-0"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

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

                  {/* ── TRAFFIC ANALYSIS PANEL ── */}
                  {trafficLegs.length > 0 && showTrafficPanel && (
                    <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] overflow-hidden">
                      <div className="p-4 flex items-center justify-between border-b border-[#333]">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                          <Car className="w-4 h-4 text-orange-400" /> Live
                          Traffic Analysis
                        </h2>
                        <div className="flex items-center gap-2">
                          {lastTrafficRefresh && (
                            <span className="text-xs text-gray-500">
                              {lastTrafficRefresh.toLocaleTimeString()}
                            </span>
                          )}
                          <button
                            onClick={refreshTrafficData}
                            disabled={trafficRefreshing}
                            className="text-gray-500 hover:text-[#FFC000] transition-colors"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${trafficRefreshing ? "animate-spin" : ""}`}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-[#222]">
                        {trafficLegs.map((leg, i) => {
                          const c = getCongestionColor(leg.congestionLevel);
                          return (
                            <div
                              key={i}
                              className="px-4 py-3 flex items-center gap-3"
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg} border ${c.border}`}
                              >
                                <TrendingUp className={`w-4 h-4 ${c.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium">
                                  Stop {i + 1} → Stop {i + 2}
                                </p>
                                <p
                                  className={`text-xs font-bold capitalize ${c.text}`}
                                >
                                  {leg.congestionLevel} traffic
                                  {leg.delayMin > 0 && (
                                    <span className="ml-1 text-orange-400">
                                      · +{leg.delayMin}min delay
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-white">
                                  {formatDuration(leg.durationWithTraffic)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  base: {formatDuration(leg.duration)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {trafficLegs.some(
                        (l) => l.congestionLevel !== "light",
                      ) && (
                        <div className="p-3 border-t border-[#333] bg-orange-500/5">
                          <p className="text-xs text-orange-400 font-medium flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {
                              trafficLegs.filter(
                                (l) => l.congestionLevel === "heavy",
                              ).length
                            }{" "}
                            heavy congestion and{" "}
                            {
                              trafficLegs.filter(
                                (l) => l.congestionLevel === "moderate",
                              ).length
                            }{" "}
                            moderate segments detected. Consider re-dispatching.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── DYNAMIC RE-ROUTING PANEL ── */}
                  {(rerouteResult ||
                    rerouteLoading ||
                    disruptions.length > 0) && (
                    <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] overflow-hidden">
                      {/* Panel header */}
                      <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                          <Repeat className="w-4 h-4 text-red-400" />
                          Dynamic Re-routing
                        </h2>
                        {disruptions.length > 0 && (
                          <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                            {disruptions.length} disruption
                            {disruptions.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* ── LOADING STATE ── */}
                      {rerouteLoading && (
                        <div className="p-6 flex flex-col items-center gap-3 border-b border-[#2a2a2a]">
                          <div className="relative w-14 h-14">
                            <div className="absolute inset-0 rounded-full border-2 border-[#FFC000]/15" />
                            <div className="absolute inset-0 rounded-full border-t-2 border-[#FFC000] animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Repeat className="w-5 h-5 text-[#FFC000]" />
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-white">
                              Recalculating Route
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Re-sorting stops by priority, weather &amp;
                              traffic…
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── REROUTE RESULT ── */}
                      {rerouteResult &&
                        !rerouteLoading &&
                        (() => {
                          const timeDelta =
                            rerouteResult.rerouteDuration -
                            routeResults.totalDuration;
                          const distDelta =
                            rerouteResult.rerouteDistance -
                            routeResults.totalDistance;
                          const timeSaved = timeDelta < 0;
                          const distSaved = distDelta < 0;
                          const proactiveSavedSec =
                            rerouteResult.savedSeconds ?? 0;
                          return (
                            <div className="p-4 border-b border-[#2a2a2a]">
                              {/* Success header row */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 bg-green-500/15 border border-green-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white flex items-center gap-2">
                                      Route Recalculated
                                      {rerouteResult.reordered && (
                                        <span className="text-[10px] font-bold text-[#FFC000] bg-[#FFC000]/10 border border-[#FFC000]/30 px-1.5 py-0.5 rounded-full">
                                          Re-sorted
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {rerouteResult.timestamp.toLocaleTimeString()}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setRerouteResult(null)}
                                  className="text-gray-600 hover:text-gray-400 transition-colors mt-0.5"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Skipped stop pill */}
                              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-xl">
                                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                <p className="text-xs text-gray-400 min-w-0 truncate">
                                  Skipped:{" "}
                                  <span className="text-white font-bold">
                                    {
                                      rerouteResult.skippedStop?.name?.split(
                                        ",",
                                      )[0]
                                    }
                                  </span>
                                </p>
                              </div>

                              {/* Before → After comparison */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {/* Before */}
                                <div className="bg-black/40 rounded-xl p-3 border border-[#2a2a2a]">
                                  <p className="text-xs text-gray-600 mb-1.5 font-medium uppercase tracking-wide">
                                    Before
                                  </p>
                                  <p className="text-base font-bold text-gray-400">
                                    {formatDuration(routeResults.totalDuration)}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {formatDistance(routeResults.totalDistance)}
                                  </p>
                                </div>
                                {/* After */}
                                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                                  <p className="text-xs text-green-600 mb-1.5 font-medium uppercase tracking-wide">
                                    After
                                  </p>
                                  <p
                                    className={`text-base font-bold ${timeSaved ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {formatDuration(
                                      rerouteResult.rerouteDuration,
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {formatDistance(
                                      rerouteResult.rerouteDistance,
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Delta badges */}
                              <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                                    timeSaved
                                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                                      : "text-red-400 bg-red-500/10 border-red-500/20"
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  {timeSaved ? "−" : "+"}
                                  {formatDuration(Math.abs(timeDelta))}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                                    distSaved
                                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                                      : "text-red-400 bg-red-500/10 border-red-500/20"
                                  }`}
                                >
                                  <Navigation className="w-3 h-3" />
                                  {distSaved ? "−" : "+"}
                                  {formatDistance(Math.abs(distDelta))}
                                </span>
                                {proactiveSavedSec > 60 && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border text-[#FFC000] bg-[#FFC000]/10 border-[#FFC000]/20">
                                    <TrendingUp className="w-3 h-3" />~
                                    {formatDuration(proactiveSavedSec)} saved vs
                                    disrupted path
                                  </span>
                                )}
                              </div>

                              {/* Remaining stops count */}
                              <div className="flex items-center justify-between px-3 py-2 bg-black/40 border border-[#2a2a2a] rounded-xl">
                                <div className="flex items-center gap-2">
                                  <Milestone className="w-3.5 h-3.5 text-[#FFC000]" />
                                  <span className="text-xs text-gray-400">
                                    Remaining stops
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-white">
                                  {rerouteResult.newRoute.length}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                      {/* ── DISRUPTIONS LIST ── */}
                      {disruptions.length > 0 && (
                        <div className="divide-y divide-[#1f1f1f]">
                          {disruptions.map((d, i) => {
                            const typeConfig = {
                              closure: {
                                Icon: XCircle,
                                color: "text-red-400",
                                bg: "bg-red-500/10",
                                border: "border-red-500/25",
                                label: "Road Closure",
                              },
                              accident: {
                                Icon: ShieldAlert,
                                color: "text-orange-400",
                                bg: "bg-orange-500/10",
                                border: "border-orange-500/25",
                                label: "Accident",
                              },
                              flooding: {
                                Icon: Droplets,
                                color: "text-blue-400",
                                bg: "bg-blue-500/10",
                                border: "border-blue-500/25",
                                label: "Flooding",
                              },
                              construction: {
                                Icon: Construction,
                                color: "text-yellow-400",
                                bg: "bg-yellow-500/10",
                                border: "border-yellow-500/25",
                                label: "Roadworks",
                              },
                            };
                            const { Icon, color, bg, border, label } =
                              typeConfig[d.type] ?? typeConfig.construction;
                            return (
                              <div
                                key={i}
                                className="px-4 py-3 flex items-start gap-3"
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center flex-shrink-0 mt-0.5`}
                                >
                                  <Icon className={`w-4 h-4 ${color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span
                                      className={`text-xs font-bold ${color}`}
                                    >
                                      {label}
                                    </span>
                                    <span className="text-gray-700 text-xs">
                                      ·
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Stop {d.stopIndex + 1}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400 leading-relaxed">
                                    {d.description ||
                                      "Route disruption reported — stop skipped"}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {d.timestamp.toLocaleTimeString()}
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg flex-shrink-0 mt-0.5">
                                  Skipped
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── INTER-POSTMAN REDIRECTION PANEL ── */}
                  {(redirectionLog.length > 0 ||
                    showRedirectPanel !== null) && (
                    <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] overflow-hidden">
                      <div className="p-4 flex items-center justify-between border-b border-[#333]">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                          <ArrowLeftRight className="w-4 h-4 text-purple-400" />{" "}
                          Postman Handoffs
                        </h2>
                        {redirectionLog.length > 0 && (
                          <button
                            onClick={() =>
                              setShowRedirectionLog(!showRedirectionLog)
                            }
                            className="text-xs text-purple-400 font-bold hover:text-purple-300"
                          >
                            {showRedirectionLog
                              ? "Hide"
                              : `View ${redirectionLog.length}`}
                          </button>
                        )}
                      </div>

                      {/* Select postman panel */}
                      {showRedirectPanel !== null && (
                        <div className="p-4 border-b border-[#333] bg-purple-500/5">
                          <p className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" />
                            Assign Stop {showRedirectPanel + 1} to a nearby
                            postman
                          </p>
                          {loadingNearby ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                              Finding nearby postmen...
                            </div>
                          ) : nearbyPostmen.filter((p) => p.is_available)
                              .length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                              <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-600" />
                              </div>
                              <p className="text-xs text-gray-500">
                                No available postmen within 15 km.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {nearbyPostmen
                                .filter((p) => p.is_available)
                                .slice(0, 4)
                                .map((postman) => {
                                  // Generate initials + deterministic avatar color
                                  const initials = (postman.name || "?")
                                    .split(" ")
                                    .map((w) => w[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase();
                                  const avatarColors = [
                                    ["#6366F1", "#3730A3"],
                                    ["#8B5CF6", "#5B21B6"],
                                    ["#EC4899", "#9D174D"],
                                    ["#14B8A6", "#0F766E"],
                                  ];
                                  const colorPair =
                                    avatarColors[
                                      (postman.postman_id?.charCodeAt(0) ?? 0) %
                                        avatarColors.length
                                    ];
                                  // Workload bar: deliveries_left out of an assumed 20 max
                                  const workloadMax = 20;
                                  const workloadPct = Math.min(
                                    100,
                                    Math.round(
                                      ((postman.deliveries_left ?? 0) /
                                        workloadMax) *
                                        100,
                                    ),
                                  );
                                  const distNum =
                                    parseFloat(postman.distance_km) || 0;
                                  const distColor =
                                    distNum < 3
                                      ? "text-green-400"
                                      : distNum < 8
                                        ? "text-[#FFC000]"
                                        : "text-red-400";

                                  return (
                                    <div
                                      key={postman.postman_id}
                                      className="p-3 bg-black/40 border border-[#2a2a2a] hover:border-purple-500/30 rounded-xl transition-all group"
                                    >
                                      {/* Top row: avatar + info + distance */}
                                      <div className="flex items-center gap-3 mb-2.5">
                                        {/* Avatar */}
                                        <div
                                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white shadow-lg"
                                          style={{
                                            background: `linear-gradient(135deg, ${colorPair[0]}, ${colorPair[1]})`,
                                          }}
                                        >
                                          {initials}
                                        </div>
                                        {/* Name + zone */}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-bold text-white truncate">
                                            {postman.name}
                                          </p>
                                          <p className="text-xs text-gray-500 truncate">
                                            {postman.zone || postman.email}
                                          </p>
                                        </div>
                                        {/* Distance badge */}
                                        <div className="text-right flex-shrink-0">
                                          <p
                                            className={`text-base font-bold ${distColor}`}
                                          >
                                            {postman.distance_km} km
                                          </p>
                                          <p className="text-xs text-green-400 font-medium">
                                            Available
                                          </p>
                                        </div>
                                      </div>

                                      {/* Workload bar */}
                                      <div className="mb-2.5">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs text-gray-600">
                                            Workload
                                          </span>
                                          <span className="text-xs text-gray-400 font-medium">
                                            {postman.deliveries_left ?? "—"}{" "}
                                            stops left
                                          </span>
                                        </div>
                                        <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${workloadPct}%`,
                                              backgroundColor:
                                                workloadPct > 70
                                                  ? "#EF4444"
                                                  : workloadPct > 40
                                                    ? "#FFC000"
                                                    : "#22C55E",
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {/* Assign button */}
                                      <button
                                        onClick={() =>
                                          assignRedirection(
                                            showRedirectPanel,
                                            postman,
                                          )
                                        }
                                        className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        Assign Stop {showRedirectPanel +
                                          1} to {initials}
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                          <button
                            onClick={() => setShowRedirectPanel(null)}
                            className="mt-2 w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Redirection log */}
                      {showRedirectionLog && redirectionLog.length > 0 && (
                        <div className="divide-y divide-[#222]">
                          {redirectionLog.map((event) => (
                            <div
                              key={event.id}
                              className="px-4 py-3 flex items-start gap-3"
                            >
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <LogIn className="w-4 h-4 text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-bold truncate">
                                  {event.stopName?.split(",")[0]}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  → {event.postman?.name} ·{" "}
                                  {event.postman?.zone}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {event.reason} ·{" "}
                                  {event.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-purple-400 flex-shrink-0">
                                Transferred
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!showRedirectionLog && redirectionLog.length > 0 && (
                        <div className="p-3 flex items-center gap-2">
                          <div className="flex -space-x-1">
                            {redirectionLog.slice(0, 3).map((_, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center"
                              >
                                <UserCheck className="w-3 h-3 text-purple-400" />
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400">
                            {redirectionLog.length} stop
                            {redirectionLog.length !== 1 ? "s" : ""}{" "}
                            successfully handed off
                          </p>
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

                    {/* Optimized Delivery Order */}
                    <div className="pt-4 border-t border-[#333]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Optimized Delivery Order
                        </h4>
                        <span className="text-xs text-gray-600">
                          {routeResults.optimizedRoute.length} stops
                        </span>
                      </div>

                      {priorityMode ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2 p-2 bg-black/30 rounded-xl border border-[#333]">
                            {Object.entries(PRIORITIES).map(([key, p]) => (
                              <div
                                key={key}
                                className="flex items-center gap-1.5"
                              >
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      getPriorityMarkerColor(key),
                                  }}
                                />
                                <span
                                  className={`text-xs font-semibold ${p.color}`}
                                >
                                  {p.label}
                                </span>
                              </div>
                            ))}
                          </div>

                          {startPoint && (
                            <>
                              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-green-500 flex-shrink-0">
                                  <Navigation className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-bold truncate">
                                    {startPoint.name?.split(",")[0] ||
                                      "Start Location"}
                                  </p>
                                  <p className="text-xs text-green-400">
                                    Start Point
                                  </p>
                                </div>
                                <div className="px-2 py-1 bg-green-500/20 rounded text-xs font-bold text-green-400">
                                  START
                                </div>
                              </div>
                              {/* Connector arrow */}
                              <div className="flex items-center gap-3 px-1 py-0.5">
                                <div className="w-8 flex justify-center flex-shrink-0">
                                  <div className="flex flex-col items-center gap-[3px]">
                                    <div className="w-px h-2 bg-green-500/60" />
                                    <div className="w-px h-2 bg-green-500/40" />
                                    <div
                                      className="w-0 h-0"
                                      style={{
                                        borderLeft: "4px solid transparent",
                                        borderRight: "4px solid transparent",
                                        borderTop:
                                          "5px solid rgba(34,197,94,0.55)",
                                      }}
                                    />
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">
                                  Optimized route begins
                                </span>
                              </div>
                            </>
                          )}

                          {["urgent", "high", "normal", "low"].map(
                            (priorityKey) => {
                              const stopsForPriority =
                                routeResults.optimizedRoute
                                  .map((loc, i) => ({ ...loc, routeIndex: i }))
                                  .filter(
                                    (loc) =>
                                      (loc.priority || "normal") ===
                                      priorityKey,
                                  );
                              if (stopsForPriority.length === 0) return null;
                              const p = PRIORITIES[priorityKey];
                              return (
                                <div key={priorityKey}>
                                  <div
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1.5 ${p.bg} border ${p.border}`}
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{
                                        backgroundColor:
                                          getPriorityMarkerColor(priorityKey),
                                      }}
                                    />
                                    <span
                                      className={`text-xs font-bold uppercase tracking-widest ${p.color}`}
                                    >
                                      {p.label}
                                    </span>
                                    <span
                                      className={`ml-auto text-xs font-semibold opacity-70 ${p.color}`}
                                    >
                                      {stopsForPriority.length}{" "}
                                      {stopsForPriority.length === 1
                                        ? "stop"
                                        : "stops"}
                                    </span>
                                  </div>
                                  <div className="space-y-1 pl-1">
                                    {stopsForPriority.map((loc) => (
                                      <div
                                        key={loc.routeIndex}
                                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                                      >
                                        <div
                                          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0 shadow"
                                          style={{
                                            backgroundColor:
                                              getPriorityMarkerColor(
                                                loc.priority,
                                              ),
                                          }}
                                        >
                                          {loc.routeIndex + 1}
                                        </div>
                                        <p className="text-sm text-gray-300 truncate flex-1">
                                          {loc.name?.split(",")[0]}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {startPoint && (
                            <>
                              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500 flex-shrink-0">
                                  <Navigation className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-bold truncate">
                                    {startPoint.name?.split(",")[0] ||
                                      "Start Location"}
                                  </p>
                                  <p className="text-xs text-green-400">
                                    Start Point
                                  </p>
                                </div>
                                <div className="px-2 py-1 bg-green-500/20 rounded text-xs font-bold text-green-400">
                                  START
                                </div>
                              </div>
                              {/* Connector arrow */}
                              <div className="flex items-center gap-3 px-1 py-0.5">
                                <div className="w-6 flex justify-center flex-shrink-0">
                                  <div className="flex flex-col items-center gap-[3px]">
                                    <div className="w-px h-2 bg-green-500/60" />
                                    <div className="w-px h-2 bg-green-500/40" />
                                    <div
                                      className="w-0 h-0"
                                      style={{
                                        borderLeft: "4px solid transparent",
                                        borderRight: "4px solid transparent",
                                        borderTop:
                                          "5px solid rgba(34,197,94,0.55)",
                                      }}
                                    />
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">
                                  Optimized route begins
                                </span>
                              </div>
                            </>
                          )}
                          {routeResults.optimizedRoute.map((loc, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 px-1 py-1 hover:bg-white/[0.03] rounded-lg transition-colors"
                            >
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                                style={{ backgroundColor: "#FFC000" }}
                              >
                                {i + 1}
                              </div>
                              <p className="text-sm text-gray-300 truncate flex-1">
                                {loc.name?.split(",")[0]}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ PRIORITY UPDATE MODAL ═══ */}
      {deliveryMode && priorityUpdateMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
              <div className="w-10 h-10 bg-[#FFC000]/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#FFC000]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Update Priority
                </h3>
                <p className="text-xs text-gray-500">
                  {priorityPreview
                    ? "Route impact preview — confirm or pick another"
                    : "Tap a priority level to preview the route impact"}
                </p>
              </div>
            </div>

            {/* ── Before / After Preview Panel — always on top, appears on first selection ── */}
            <div className="flex-shrink-0 mb-3">
              {priorityPreview ? (
                <div className="rounded-xl border border-[#FFC000]/40 bg-[#FFC000]/5 overflow-hidden">
                  {/* Panel header */}
                  <div className="px-3 py-2 border-b border-[#FFC000]/20 flex items-center gap-2">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#FFC000]" />
                    <span className="text-xs font-bold text-[#FFC000] uppercase tracking-wider">
                      Route Impact Preview
                    </span>
                    <span className="ml-1 text-xs text-gray-400">
                      — Stop {priorityPreview.stopIndex + 1} →{" "}
                      <span
                        className="font-bold"
                        style={{
                          color: getPriorityMarkerColor(
                            priorityPreview.newPriority,
                          ),
                        }}
                      >
                        {PRIORITIES[priorityPreview.newPriority]?.label}
                      </span>
                    </span>
                    {priorityPreview.calculating && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Calculating…
                      </span>
                    )}
                  </div>

                  {/* Before / After metric rows */}
                  <div className="px-3 pb-3 pt-2 space-y-2">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center mb-1">
                      <span />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest w-16 text-center">
                        Before
                      </span>
                      <span className="text-[10px] font-bold text-[#FFC000] uppercase tracking-widest w-16 text-center">
                        After
                      </span>
                    </div>

                    {/* Est. Time row */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center bg-black/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-400">Est. Time</span>
                      </div>
                      {/* Before */}
                      <span className="text-sm font-bold text-white w-16 text-center">
                        {formatDuration(priorityPreview.beforeDuration)}
                      </span>
                      {/* After */}
                      <div className="flex flex-col items-center gap-0.5 w-16">
                        {priorityPreview.calculating ? (
                          <div className="h-4 w-14 bg-white/10 rounded animate-pulse" />
                        ) : priorityPreview.afterDuration != null ? (
                          <>
                            <span
                              className="text-sm font-bold"
                              style={{
                                color:
                                  priorityPreview.afterDuration <
                                  priorityPreview.beforeDuration
                                    ? "#22C55E"
                                    : priorityPreview.afterDuration >
                                        priorityPreview.beforeDuration
                                      ? "#EF4444"
                                      : "#fff",
                              }}
                            >
                              {formatDuration(priorityPreview.afterDuration)}
                            </span>
                            {priorityPreview.afterDuration !==
                              priorityPreview.beforeDuration && (
                              <span
                                className="text-[10px] font-bold px-1 py-0.5 rounded leading-none"
                                style={{
                                  color:
                                    priorityPreview.afterDuration <
                                    priorityPreview.beforeDuration
                                      ? "#22C55E"
                                      : "#EF4444",
                                  backgroundColor:
                                    priorityPreview.afterDuration <
                                    priorityPreview.beforeDuration
                                      ? "#22C55E22"
                                      : "#EF444422",
                                }}
                              >
                                {priorityPreview.afterDuration <
                                priorityPreview.beforeDuration
                                  ? "−"
                                  : "+"}
                                {formatDuration(
                                  Math.abs(
                                    priorityPreview.afterDuration -
                                      priorityPreview.beforeDuration,
                                  ),
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </div>

                    {/* Total Distance row */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center bg-black/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Route className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-400">
                          Total Dist.
                        </span>
                      </div>
                      {/* Before */}
                      <span className="text-sm font-bold text-white w-16 text-center">
                        {formatDistance(priorityPreview.beforeDistance)}
                      </span>
                      {/* After */}
                      <div className="flex flex-col items-center gap-0.5 w-16">
                        {priorityPreview.calculating ? (
                          <div className="h-4 w-14 bg-white/10 rounded animate-pulse" />
                        ) : priorityPreview.afterDistance != null ? (
                          <>
                            <span
                              className="text-sm font-bold"
                              style={{
                                color:
                                  priorityPreview.afterDistance <
                                  priorityPreview.beforeDistance
                                    ? "#22C55E"
                                    : priorityPreview.afterDistance >
                                        priorityPreview.beforeDistance
                                      ? "#EF4444"
                                      : "#fff",
                              }}
                            >
                              {formatDistance(priorityPreview.afterDistance)}
                            </span>
                            {priorityPreview.afterDistance !==
                              priorityPreview.beforeDistance && (
                              <span
                                className="text-[10px] font-bold px-1 py-0.5 rounded leading-none"
                                style={{
                                  color:
                                    priorityPreview.afterDistance <
                                    priorityPreview.beforeDistance
                                      ? "#22C55E"
                                      : "#EF4444",
                                  backgroundColor:
                                    priorityPreview.afterDistance <
                                    priorityPreview.beforeDistance
                                      ? "#22C55E22"
                                      : "#EF444422",
                                }}
                              >
                                {priorityPreview.afterDistance <
                                priorityPreview.beforeDistance
                                  ? "−"
                                  : "+"}
                                {formatDistance(
                                  Math.abs(
                                    priorityPreview.afterDistance -
                                      priorityPreview.beforeDistance,
                                  ),
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Confirm button */}
                  {!priorityPreview.calculating &&
                    priorityPreview.afterDuration != null && (
                      <div className="px-3 pb-3 pt-1">
                        <button
                          onClick={() => {
                            changePriority(
                              priorityPreview.stopIndex,
                              priorityPreview.newPriority,
                            );
                            setPriorityPreview(null);
                            setPriorityUpdateMode(false);
                          }}
                          className="w-full py-2.5 rounded-lg text-sm font-bold text-black bg-[#FFC000] hover:bg-[#FFD040] transition-all"
                        >
                          Confirm Change
                        </button>
                      </div>
                    )}
                </div>
              ) : (
                /* Placeholder shown before any selection */
                <div className="rounded-xl border border-dashed border-[#333] bg-black/20 px-4 py-3 flex items-center gap-3">
                  <ArrowLeftRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <p className="text-xs text-gray-600">
                    Before / After comparison will appear here once you tap a
                    priority level below.
                  </p>
                </div>
              )}
            </div>

            {/* Stop list — always visible, scrollable */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 mb-3">
              {routeResults?.optimizedRoute
                .map((stop, idx) => ({ ...stop, originalIndex: idx }))
                .filter((stop) => !completedStops.has(stop.originalIndex))
                .map((stop) => {
                  const actualIdx = stop.originalIndex;
                  const isSelected = priorityPreview?.stopIndex === actualIdx;
                  return (
                    <div
                      key={actualIdx}
                      className={`p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-[#FFC000]/5 border-[#FFC000]/40"
                          : "bg-black/40 border-[#333]"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">
                            {stop.name?.split(",")[0]}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Stop {actualIdx + 1}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${PRIORITIES[stop.priority]?.bg} ${PRIORITIES[stop.priority]?.color} ${PRIORITIES[stop.priority]?.border} border`}
                        >
                          {PRIORITIES[stop.priority]?.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.keys(PRIORITIES).map((priority) => {
                          const isCurrentPriority = stop.priority === priority;
                          const isPreviewedPriority =
                            isSelected &&
                            priorityPreview?.newPriority === priority;
                          return (
                            <button
                              key={priority}
                              onClick={() =>
                                previewPriorityChange(actualIdx, priority)
                              }
                              disabled={isCurrentPriority}
                              className={`px-2 py-1.5 rounded text-xs font-bold transition-all relative ${
                                isCurrentPriority
                                  ? "opacity-40 cursor-not-allowed"
                                  : isPreviewedPriority
                                    ? "ring-2 ring-white/60 scale-105 shadow-lg"
                                    : "hover:opacity-90 hover:scale-105"
                              } ${PRIORITIES[priority].bg} ${PRIORITIES[priority].color} ${PRIORITIES[priority].border} border`}
                            >
                              {PRIORITIES[priority].label}
                              {isPreviewedPriority && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            <button
              onClick={() => {
                setPriorityPreview(null);
                setPriorityUpdateMode(false);
              }}
              className="flex-shrink-0 w-full py-2.5 text-sm text-gray-500 hover:text-white transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ CUSTOMER RELOCATION MODAL ═══ */}
      {showRelocationModal && relocationTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* ── Header ── */}
            <div className="flex items-center gap-3 p-5 border-b border-[#2a2a2a]">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">
                  Customer Relocated
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  Stop {relocationTarget + 1} —{" "}
                  {
                    routeResults?.optimizedRoute[relocationTarget]?.name?.split(
                      ",",
                    )[0]
                  }
                </p>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="p-5 space-y-4">
              {/* Current address */}
              <div className="flex items-start gap-3 p-3 bg-black/40 border border-[#2a2a2a] rounded-xl">
                <div className="w-6 h-6 rounded-full bg-gray-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">
                    Current address
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed line-through opacity-60">
                    {
                      routeResults?.optimizedRoute[
                        relocationTarget
                      ]?.name?.split(",")[0]
                    }
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-orange-400">
                  <div className="h-px w-8 bg-orange-500/30" />
                  <ArrowRight className="w-4 h-4" />
                  <div className="h-px w-8 bg-orange-500/30" />
                </div>
              </div>

              {/* New address input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  New Delivery Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  <input
                    ref={relocationInputRef}
                    type="text"
                    placeholder="Search new address…"
                    className="w-full pl-9 pr-4 py-3 bg-black border border-[#333] focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all"
                  />
                </div>
                {newRelocationAddress && (
                  <div className="flex items-start gap-2 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-300 font-medium leading-relaxed">
                      {newRelocationAddress.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Info note */}
              <p className="text-xs text-gray-600 leading-relaxed text-center">
                The route will automatically re-optimise to the new location.
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={cancelRelocationModal}
                  className="flex-1 py-2.5 text-sm text-gray-500 hover:text-white transition-colors font-medium border border-[#333] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSelfHandleRelocation}
                  disabled={!newRelocationAddress}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-400 text-white flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Update Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DISRUPTION MODAL ═══ */}
      {showDisruptionModal && disruptionTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                <Siren className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Report Disruption
                </h3>
                <p className="text-xs text-gray-500">
                  Stop {disruptionTarget + 1} — route will be recalculated
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { type: "closure", label: "Road Closure", icon: XCircle },
                { type: "accident", label: "Accident", icon: ShieldAlert },
                { type: "flooding", label: "Flooding", icon: Droplets },
                {
                  type: "construction",
                  label: "Roadworks",
                  icon: Construction,
                },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => reportDisruption(disruptionTarget, type)}
                  className="flex flex-col items-center gap-2 p-3 bg-black/40 hover:bg-red-500/10 border border-[#333] hover:border-red-500/30 rounded-xl transition-all"
                >
                  <Icon className="w-5 h-5 text-red-400" />
                  <span className="text-xs text-white font-medium">
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowDisruptionModal(false);
                setDisruptionTarget(null);
              }}
              className="w-full py-2.5 text-sm text-gray-500 hover:text-white transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ ALL DELIVERIES COMPLETE — SUCCESS MODAL ═══ */}
      {showDeliverySuccess &&
        (() => {
          const allStops = routeResults?.optimizedRoute ?? [];
          const relocatedIndexes = new Set(
            relocationEvents.map((e) => e.stopIndex),
          );
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6">
              <div className="bg-[#1A1A1A] border border-green-500/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* ── Header ── */}
                <div className="flex flex-col items-center justify-center px-6 pt-7 pb-5 bg-green-500/5 border-b border-green-500/20 flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center mb-3">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    All Deliveries Complete!
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Every stop has been delivered successfully.
                  </p>

                  {/* ── Stats row ── */}
                  <div className="flex gap-3 mt-4 w-full">
                    <div className="flex-1 p-2.5 bg-black/40 border border-[#2a2a2a] rounded-xl text-center">
                      <p className="text-xs text-gray-500 mb-0.5">
                        Total Stops
                      </p>
                      <p className="text-xl font-bold text-white">
                        {allStops.length}
                      </p>
                    </div>
                    <div className="flex-1 p-2.5 bg-black/40 border border-green-500/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500 mb-0.5">Delivered</p>
                      <p className="text-xl font-bold text-green-400">
                        {allStops.length - relocatedIndexes.size}
                      </p>
                    </div>
                    <div className="flex-1 p-2.5 bg-black/40 border border-orange-500/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500 mb-0.5">Relocated</p>
                      <p className="text-xl font-bold text-orange-400">
                        {relocatedIndexes.size}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Stop-by-stop breakdown ── */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {allStops.map((stop, i) => {
                    const isRelocated = relocatedIndexes.has(i);
                    const relocEvent = relocationEvents.find(
                      (e) => e.stopIndex === i,
                    );
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border p-3 ${
                          isRelocated
                            ? "bg-orange-500/5 border-orange-500/20"
                            : "bg-green-500/5 border-green-500/15"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Stop number badge */}
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              isRelocated
                                ? "bg-orange-500/20 text-orange-300"
                                : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            {i + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Status tag */}
                            <div className="flex items-center gap-1.5 mb-1">
                              {isRelocated ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                                  <MapPin className="w-3 h-3" /> Relocated
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-bold text-green-400">
                                  <CheckCircle className="w-3 h-3" /> Delivered
                                </span>
                              )}
                              {stop.priority && (
                                <span
                                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${PRIORITIES[stop.priority]?.bg} ${PRIORITIES[stop.priority]?.color}`}
                                >
                                  {PRIORITIES[stop.priority]?.label}
                                </span>
                              )}
                            </div>

                            {/* Address */}
                            {isRelocated && relocEvent ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-500 line-through leading-tight">
                                  {relocEvent.oldAddress?.split(",")[0]}
                                </p>
                                <div className="flex items-center gap-1">
                                  <ArrowRight className="w-3 h-3 text-orange-400 flex-shrink-0" />
                                  <p className="text-xs text-orange-200 font-medium leading-tight truncate">
                                    {relocEvent.newAddress?.split(",")[0]}
                                  </p>
                                </div>
                                {relocEvent.detourKm != null && (
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    +{relocEvent.detourKm.toFixed(2)} km detour
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-300 leading-tight truncate">
                                {stop.name?.split(",")[0]}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Back to planner ── */}
                <div className="p-4 border-t border-[#2a2a2a] flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowDeliverySuccess(false);
                      setDeliveryMode(false);
                      setSessionId(null);
                      setCurrentStopIdx(0);
                      setCompletedStops(new Set());
                      setDisruptions([]);
                      setRerouteResult(null);
                      setRelocationEvents([]);
                      setAutoRelocationAlerts([]);
                      clearPriorityPolylines();
                      if (directionsRenderer)
                        directionsRenderer.setDirections({ routes: [] });
                      clientSnapshotRef.current = {};
                      clearInterval(clientPollRef.current);
                      completedMarkersRef.current.forEach((m) =>
                        m?.setMap(null),
                      );
                      completedMarkersRef.current = [];
                    }}
                    className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Done — Back to Planner
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default RouteOptimizer;
