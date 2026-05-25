/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Home, ShieldAlert, Navigation, Compass, Plus, Info, Layers, Map as MapIcon, Grid, Globe, Settings2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, Shelter, SOSSignal } from '../types';
import { translations, Language } from '../translations';

interface EmergencyMapProps {
  incidents: Incident[];
  shelters: Shelter[];
  sosSignals: SOSSignal[];
  selectedLocation: { lat: number; lng: number; address: string } | null;
  onSelectLocation?: (loc: { lat: number; lng: number; address: string }) => void;
  interactive?: boolean;
  lang?: Language;
}

export default function EmergencyMap({
  incidents,
  shelters,
  sosSignals,
  selectedLocation,
  onSelectLocation,
  interactive = true,
  lang = 'vi',
}: EmergencyMapProps) {
  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || '';
  };

  // Switch between the real interactive GIS Map of Vietnam versus the tactical stylized SVG CAD mock grid
  const [mapMode, setMapMode] = useState<'real' | 'cad'>('real');
  
  // Real Map Tile Style (CartoDB Dark Matter vs Standard OSM Maps)
  const [mapStyle, setMapStyle] = useState<'dark' | 'standard'>('dark');

  // React Refs for Leaflet Map State Lifecycle guarding
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Approximate center of Vietnam sandbox core in HCMC
  const mapCenter = { lat: 10.7626, lng: 106.6601 };

  // ==========================================
  // REAL LEAFLET INTEGRATION FLOW
  // ==========================================
  
  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (mapMode !== 'real') {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
        tileLayerRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // already active

    // Establish Leaflet instance targeting HCMC or user's previous selection
    const initialCenter: L.LatLngExpression = selectedLocation
      ? [selectedLocation.lat, selectedLocation.lng]
      : [mapCenter.lat, mapCenter.lng];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: true,
    });
    mapRef.current = map;

    // Apply starting tile layer configuration
    const url = mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attr = mapStyle === 'dark'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const tileLayer = L.tileLayer(url, { attribution: attr }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Separate clean overlay group for system pins
    const markerLayer = L.layerGroup().addTo(map);
    markerLayerRef.current = markerLayer;

    // Click handler for coordinates extraction on Vietnam's actual earth grid
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      let address = lang === 'vi' 
        ? `Tọa độ thực địa [Vĩ độ: ${lat.toFixed(5)}, Kinh độ: ${lng.toFixed(5)}]`
        : `Real Location [Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}]`;

      if (onSelectLocation) {
        // Send fast placeholder coordinate immediately
        onSelectLocation({ lat, lng, address });

        // Trigger safe Nominatim reverse geocoding API integration to get real house numbers, streets, and districts in Vietnam!
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang === 'vi' ? 'vi' : 'en'},vi,en`, {
            headers: { 'User-Agent': 'SafeBlockEmergencyVietnamMapClient' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              onSelectLocation({ lat, lng, address: data.display_name });
            }
          }
        } catch (err) {
          console.error('OSM Nominatim coordinate lookup failure (falling back to coordinate placeholder):', err);
        }
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [mapMode]);

  // 2. Handle on-the-fly map style tile swapping (Cartodb Dark vs Standard Street Maps)
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || mapMode !== 'real') return;

    tileLayerRef.current.remove();

    const url = mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attr = mapStyle === 'dark'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const newTileLayer = L.tileLayer(url, { attribution: attr }).addTo(mapRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapStyle, mapMode]);

  // 3. Keep Leaflet Markers strictly synchronized with system reactive arrays!
  useEffect(() => {
    if (mapMode !== 'real' || !mapRef.current || !markerLayerRef.current) return;

    const markerLayer = markerLayerRef.current;
    markerLayer.clearLayers();

    // Redraw active incident reports on Vietnam's actual grids
    incidents.forEach((incident) => {
      if (incident.status === 'resolved' || incident.status === 'rejected') return;

      const isCritical = incident.severity === 'critical';
      const colorClass = isCritical ? 'bg-rose-500' : 'bg-amber-500';
      const pingClass = isCritical ? 'bg-rose-500/30' : 'bg-amber-500/30';
      const severityText = lang === 'vi' ? translations.vi[`severity_${incident.severity}`] : translations.en[`severity_${incident.severity}`];

      const htmlIcon = `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <div class="absolute w-full h-full rounded-full ${pingClass} animate-ping" style="animation-duration: 2s"></div>
          <div class="w-5 h-5 rounded-md ${colorClass} border-2 border-slate-950 flex items-center justify-center text-white font-extrabold text-[9px] rotate-45 select-none shadow-md">
            <span class="-rotate-45 block">⚠️</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: htmlIcon,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([incident.location.lat, incident.location.lng], { icon });
      const popHTML = `
        <div class="p-2.5 font-sans text-xs bg-slate-950 text-slate-200 rounded border border-slate-800 min-w-[210px]">
          <h4 class="font-bold text-sm text-white mb-1 truncate">${incident.title}</h4>
          <p class="text-slate-400 mb-1 line-clamp-2">${incident.description}</p>
          <div class="flex items-center gap-1.5 mt-2">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 border border-slate-800 text-slate-300 uppercase">${incident.category.toUpperCase()}</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isCritical ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'} border border-red-500/10">${severityText}</span>
          </div>
          <p class="mt-2 text-[10px] text-sky-400 font-mono italic whitespace-normal">📍 ${incident.location.address || 'Vietnam Geo Matrix'}</p>
        </div>
      `;
      marker.bindPopup(popHTML);
      marker.addTo(markerLayer);
    });

    // Redraw safe shelters
    shelters.forEach((shelter) => {
      const isFull = shelter.status === 'full';
      const isClosed = shelter.status === 'closed';
      if (isClosed) return;

      const colorClass = isFull ? 'bg-amber-500' : 'bg-emerald-500';
      const statusText = isFull ? (lang === 'vi' ? 'HẾT CHỖ' : 'FULL') : (lang === 'vi' ? 'CÒN CHỖ' : 'OPEN');

      const icon = L.divIcon({
        html: `
          <div class="relative w-8 h-8 flex items-center justify-center animate-pulse">
            <div class="absolute w-full h-full rounded-full ${isFull ? 'bg-amber-500/20' : 'bg-emerald-500/10'} animate-ping"></div>
            <div class="w-5 h-5 rounded-full ${colorClass} border-2 border-slate-950 flex items-center justify-center text-white text-[10px] shadow-lg select-none">
              🏢
            </div>
          </div>
        `,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([shelter.location.lat, shelter.location.lng], { icon });
      const popHTML = `
        <div class="p-2.5 font-sans text-xs bg-slate-950 text-slate-200 rounded border border-slate-800 min-w-[210px]">
          <h4 class="font-bold text-sm text-emerald-400 mb-1">${shelter.name}</h4>
          <p class="text-slate-400 mb-1">📞 ${shelter.contact || 'N/A'}</p>
          <p class="text-slate-400 mb-2 truncate font-mono text-[10px]">📍 ${shelter.address}</p>
          <div class="flex items-center justify-between text-[10px] text-slate-300 border-t border-slate-900 pt-1.5 mt-1">
            <span>Sức chứa: <b>${shelter.occupied}/${shelter.capacity}</b></span>
            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-900 text-emerald-300 border border-slate-800">${statusText}</span>
          </div>
        </div>
      `;
      marker.bindPopup(popHTML);
      marker.addTo(markerLayer);
    });

    // Redraw SOS beacons
    sosSignals.forEach((sos) => {
      if (sos.status === 'rescued') return;

      const isResponding = sos.status === 'responding';
      const colorClass = isResponding ? 'bg-amber-500' : 'bg-red-600';
      const pulseClass = isResponding ? 'bg-amber-500/20' : 'bg-red-500/35';
      const priorityText = sos.isVulnerable
        ? (lang === 'vi' ? '⚠️ ĐỘ ƯU TIÊN BIỂU ĐỎ' : '⚠️ RED HOT CLYST VIP')
        : (lang === 'vi' ? 'YÊU CẦU DI TẢN' : 'STANDARD ALERT');

      const icon = L.divIcon({
        html: `
          <div class="relative w-12 h-12 flex items-center justify-center">
            <div class="absolute w-full h-full rounded-full ${pulseClass} animate-ping" style="animation-duration: 1.5s"></div>
            <div class="absolute w-3/4 h-3/4 rounded-full ${pulseClass} animate-pulse"></div>
            <div class="w-6 h-6 rounded-full ${colorClass} border-2 border-slate-950 flex items-center justify-center text-white font-mono font-extrabold text-[8px] shadow-xl select-none">
              SOS
            </div>
          </div>
        `,
        className: '',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker([sos.location.lat, sos.location.lng], { icon });
      const popHTML = `
        <div class="p-3 font-sans text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded min-w-[220px]">
          <h4 class="font-bold text-sm text-red-400 mb-1">🚨 YÊU CẦU THỰC ĐỊA SOS</h4>
          <p class="text-[11px] font-bold text-white mb-1 border-b border-slate-900 pb-1">${sos.userName}</p>
          <p class="text-slate-300 my-2 h-auto italic bg-slate-900/40 p-1.5 rounded border border-slate-900/60 font-light">"${sos.message || 'Cần hỗ trợ cứu hộ khẩn cấp.'}"</p>
          <div class="flex flex-col gap-1 text-[10px] mt-1 text-slate-400">
            <span class="text-rose-400 font-bold font-mono text-[9px] uppercase">${priorityText}</span>
            <span>📞 SĐT phản hồi: ${sos.phone}</span>
            <span>🔧 Trạng thái: <b class="text-amber-400 uppercase font-mono">${sos.status}</b></span>
          </div>
        </div>
      `;
      marker.bindPopup(popHTML);
      marker.addTo(markerLayer);
    });

    // Redraw user target picked pin
    if (selectedLocation) {
      const icon = L.divIcon({
        html: `
          <div class="relative w-8 h-8 flex items-center justify-center animate-bounce">
            <div class="absolute w-full h-full rounded-full bg-sky-500/20 animate-ping"></div>
            <div class="w-6 h-6 bg-sky-500 rounded-full border-2 border-slate-950 flex items-center justify-center text-white text-[12px] shadow-lg">
              📍
            </div>
          </div>
        `,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 24],
      });

      const marker = L.marker([selectedLocation.lat, selectedLocation.lng], { icon });
      const popHTML = `
        <div class="p-2 font-sans text-xs bg-blue-950 text-blue-100 rounded border border-sky-500/20 max-w-[200px]">
          <strong class="text-white block text-[11px] mb-0.5 font-mono">📍 VỊ TRÍ ĐÃ GHIM TRÊN BẢN ĐỒ THỰC:</strong>
          <p class="text-[10px] text-sky-200 leading-normal break-words whitespace-normal font-mono select-all">${selectedLocation.address || 'Vietnam Landmark Coordinate Map Index'}</p>
        </div>
      `;
      marker.bindPopup(popHTML).openPopup();
      marker.addTo(markerLayer);
    }

  }, [incidents, shelters, sosSignals, selectedLocation, mapMode, lang]);

  // 4. Pan map smoothly to chosen custom coordinates when parent selects it
  useEffect(() => {
    if (selectedLocation && mapRef.current && mapMode === 'real') {
      mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
    }
  }, [selectedLocation, mapMode]);

  // ==========================================
  // VIRTUAL VECTOR CAD GRID CONVERTERS (FALLBACK STYLE)
  // ==========================================
  const getCoordinates = (lat: number, lng: number) => {
    const latDiff = lat - mapCenter.lat;
    const lngDiff = lng - mapCenter.lng;
    const x = 50 + lngDiff * 1400;
    const y = 50 - latDiff * 1400;
    return {
      x: Math.min(Math.max(x, 5), 95),
      y: Math.min(Math.max(y, 5), 95)
    };
  };

  const handleCadMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !onSelectLocation) return;

    const svgRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;

    const pctX = (clickX / svgRect.width) * 100;
    const pctY = (clickY / svgRect.height) * 100;

    const lng = mapCenter.lng + (pctX - 50) / 1400;
    const lat = mapCenter.lat - (pctY - 50) / 1400;

    let sector = lang === 'vi' ? 'Khu trung tâm Quận 10 (TP.HCM)' : 'Central HCMC District 10 Core';
    if (lat > mapCenter.lat && lng > mapCenter.lng) {
      sector = lang === 'vi' ? 'Quận 1 / Quận 3 Border Line' : 'North-East Walkway (District 1 / 3 Border)';
    } else if (lat > mapCenter.lat && lng < mapCenter.lng) {
      sector = lang === 'vi' ? 'Khu Vực Phía Bắc Quận 10' : 'North-West Alleyways (District 10)';
    } else if (lat < mapCenter.lat && lng > mapCenter.lng) {
      sector = lang === 'vi' ? 'Bờ sông Quận 4 / Cảng Sài Gòn' : 'South-East Harbor Waterfront (District 4)';
    } else if (lat < mapCenter.lat && lng < mapCenter.lng) {
      sector = lang === 'vi' ? 'Ranh giới Cầu Quận 5 / Chợ Lớn' : 'South-West Residential Hub (District 5 Bridge)';
    }

    const address = `${sector} [Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}]`;
    onSelectLocation({ lat, lng, address });
  };

  const [hoveredDetails, setHoveredDetails] = useState<string | null>(null);

  return (
    <div className="relative w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col h-full shadow-2xl animate-fade-in">
      {/* Map Control Board Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-[1000]">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '10s' }} />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono tracking-tight uppercase">
              {mapMode === 'real' 
                ? (lang === 'vi' ? '🗺️ BẢN ĐỒ VIỆT NAM THỰC TẾ' : '🗺️ VIETNAM REAL-WORLD GIS ENGINE')
                : (lang === 'vi' ? '📐 SƠ ĐỒ CHUẨN CAD TÁC CHIẾN' : '📐 TACTICAL CAD SCHEMATIC GRID')
              }
            </h3>
            <p className="text-[10px] text-slate-400">
              {mapMode === 'real'
                ? (lang === 'vi' ? 'Khảo sát định vị trực tiếp OpenStreetMap & Nominatim GIS' : 'Direct Vectorized Tiles from OpenStreetMap and Live Geocoder')
                : (lang === 'vi' ? 'Sơ đồ hình họa tuyến tính phẳng dự phòng khi mất kết nối internet' : 'Zero-network SVG backup coordinate system layout')
              }
            </p>
          </div>
        </div>

        {/* Engine Switch & Aesthetics Pillar Configuration buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[10px] font-mono">
            <button
              onClick={() => setMapMode('real')}
              className={`px-2.5 py-1 rounded-md transition font-bold flex items-center gap-1 ${mapMode === 'real' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              title={lang === 'vi' ? 'Phân lớp Bản đồ thật Việt Nam' : 'Real GIS GPS Map of Vietnam'}
            >
              <Globe className="w-3 h-3 text-[10px]" />
              {lang === 'vi' ? 'BẢN ĐỒ THỰC' : 'REAL MAP'}
            </button>
            <button
              onClick={() => setMapMode('cad')}
              className={`px-2.5 py-1 rounded-md transition font-bold flex items-center gap-1 ${mapMode === 'cad' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200'}`}
              title={lang === 'vi' ? 'Ma trận kỹ thuật phẳng dự phòng' : 'Offline CAD SVG mesh grid'}
            >
              <Grid className="w-3 h-3 text-[10px]" />
              {lang === 'vi' ? 'SƠ ĐỒ CAD' : 'CAD GRID'}
            </button>
          </div>

          {/* Leaflet map style filter controller (visible only in real mode) */}
          {mapMode === 'real' && (
            <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[10px] font-mono">
              <button
                onClick={() => setMapStyle('dark')}
                className={`px-2 py-1 rounded transition font-bold ${mapStyle === 'dark' ? 'bg-slate-850 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                title={lang === 'vi' ? 'Chọn phong nền đen sẫm chuẩn chỉ cứu hộ' : 'Select dark mode map theme'}
              >
                {lang === 'vi' ? 'Tối' : 'Dark'}
              </button>
              <button
                onClick={() => setMapStyle('standard')}
                className={`px-2 py-1 rounded transition font-bold ${mapStyle === 'standard' ? 'bg-slate-850 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                title={lang === 'vi' ? 'Hiển thị màu sắc giao thông đường sá đầy đủ' : 'Display standard street map details'}
              >
                {lang === 'vi' ? 'Sáng' : 'Street'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Map Content Rendering Area */}
      <div className="relative flex-1 bg-slate-950 min-h-[300px] h-[345px] md:h-full cursor-crosshair">
        
        {/* VIEW A: REAL LEAFLET CONTAINER */}
        <div 
          ref={mapContainerRef} 
          className={`w-full h-full z-10 transition-opacity duration-300 ${mapMode === 'real' ? 'opacity-100 block' : 'opacity-0 hidden absolute pointer-events-none'}`}
          style={{ minHeight: '345px', backgroundColor: '#020617' }}
        />

        {/* VIEW B: OFFLINE CAD VECTOR GRID (SVG RENDERING) */}
        {mapMode === 'cad' && (
          <div className="w-full h-full absolute inset-0 animate-fade-in">
            <svg 
              className="w-full h-full" 
              viewBox="0 0 100 100" 
              preserveAspectRatio="none"
              onClick={handleCadMapClick}
            >
              {/* Canal SVG Visual Design Accents */}
              <path 
                d="M -10,35 Q 25,25 50,55 T 110,65" 
                fill="none" 
                stroke="#1d4ed8" 
                strokeWidth="3.5" 
                strokeOpacity="0.32" 
              />
              <path 
                d="M -10,35 Q 25,25 50,55 T 110,65" 
                fill="none" 
                stroke="#1e40af" 
                strokeWidth="1.2" 
                strokeOpacity="0.6" 
              />

              {/* Grid matrices */}
              <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="0.1" strokeDasharray="3 3" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.1" strokeDasharray="3 3" />

              <text x="3" y="10" className="text-[3px] fill-slate-500 font-mono uppercase">SECT-A NORTHWEST [Q.10]</text>
              <text x="73" y="10" className="text-[3px] fill-slate-500 font-mono uppercase">SECT-B NORTHEAST [Q.1/Q.3]</text>
              <text x="3" y="90" className="text-[3px] fill-slate-500 font-mono uppercase">SECT-C SOUTHWEST [Q.5/CHỢ LỚN]</text>
              <text x="73" y="90" className="text-[3px] fill-slate-500 font-mono uppercase">SECT-D SOUTHEAST [Q.4/CẢNG]</text>

              {/* Danger Heat Zones */}
              {incidents.map((incident) => {
                if (incident.status === 'rejected' || incident.status === 'resolved') return null;
                const { x, y } = getCoordinates(incident.location.lat, incident.location.lng);
                const r = incident.severity === 'critical' ? 14 : incident.severity === 'high' ? 11 : 7;
                return (
                  <circle 
                    key={`cad-heat-${incident.id}`}
                    cx={x} 
                    cy={y} 
                    r={r} 
                    fill={incident.severity === 'critical' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(249, 115, 22, 0.12)'} 
                    stroke={incident.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)'} 
                    strokeWidth="0.2" 
                    className="animate-pulse"
                  />
                );
              })}

              {/* Shelters */}
              {shelters.map((shelter) => {
                const { x, y } = getCoordinates(shelter.location.lat, shelter.location.lng);
                const isFull = shelter.status === 'full';
                const color = isFull ? '#f59e0b' : '#10b981';
                return (
                  <g 
                    key={`cad-shl-${shelter.id}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDetails(
                      lang === 'vi' 
                        ? `Trú ẩn: ${shelter.name} (Chứa ${shelter.occupied}/${shelter.capacity})` 
                        : `Shelter: ${shelter.name} (${shelter.occupied}/${shelter.capacity} load)`
                    )}
                    onMouseLeave={() => setHoveredDetails(null)}
                  >
                    <circle cx={x} cy={y} r="2" fill={color} stroke="#020617" strokeWidth="0.4" />
                    <circle cx={x} cy={y} r="4" fill="none" stroke={color} strokeWidth="0.25" className="animate-ping" style={{ animationDuration: '3.2s' }} />
                    <text x={x + 2.5} y={y + 0.8} className="text-[2.2px] fill-emerald-300 font-mono font-semibold drop-shadow">
                      {shelter.name.split(' ').slice(-2).join(' ')}
                    </text>
                  </g>
                );
              })}

              {/* SOS Beacons */}
              {sosSignals.map((sos) => {
                if (sos.status === 'rescued') return null;
                const { x, y } = getCoordinates(sos.location.lat, sos.location.lng);
                const isResponding = sos.status === 'responding';
                const rColor = isResponding ? '#fbbf24' : '#ef4444';
                return (
                  <g 
                    key={`cad-sos-${sos.id}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDetails(
                      lang === 'vi' 
                        ? `Kêu cứu SOS: ${sos.userName}${sos.isVulnerable ? ' (Ưu tiên Lớn)' : ''}` 
                        : `SOS Requested: ${sos.userName}${sos.isVulnerable ? ' (Vulnerable)' : ''}`
                    )}
                    onMouseLeave={() => setHoveredDetails(null)}
                  >
                    <circle cx={x} cy={y} r="6.2" fill="none" stroke={rColor} strokeWidth="0.4" className="animate-pulse" />
                    <circle cx={x} cy={y} r="4.2" fill="none" stroke={rColor} strokeWidth="0.25" className="animate-ping" />
                    <circle cx={x} cy={y} r="1.6" fill={rColor} stroke="#000" strokeWidth="0.3" />
                  </g>
                );
              })}

              {/* Incidents Triangle Markers */}
              {incidents.map((incident) => {
                if (incident.status === 'rejected' || incident.status === 'resolved') return null;
                const { x, y } = getCoordinates(incident.location.lat, incident.location.lng);
                const color = incident.severity === 'critical' ? '#ef4444' : '#f97316';
                return (
                  <g 
                    key={`cad-inc-${incident.id}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDetails(
                      lang === 'vi' 
                        ? `Sự cố: ${incident.title} [${incident.category.toUpperCase()}]` 
                        : `Incident: ${incident.title} [${incident.category.toUpperCase()}]`
                    )}
                    onMouseLeave={() => setHoveredDetails(null)}
                  >
                    <polygon 
                      points={`${x},${y - 2.2} ${x - 2},${y + 1.2} ${x + 2},${y + 1.2}`} 
                      fill={color} 
                      stroke="#020617" 
                      strokeWidth="0.3" 
                    />
                    {incident.status === 'verified' && (
                      <circle cx={x} cy={y + 1.5} r="0.6" fill="#10b981" stroke="#000" strokeWidth="0.15" />
                    )}
                  </g>
                );
              })}

              {/* User selected target pin */}
              {selectedLocation && (() => {
                const { x, y } = getCoordinates(selectedLocation.lat, selectedLocation.lng);
                return (
                  <g>
                    <circle cx={x} cy={y} r="3" fill="none" stroke="#60a5fa" strokeWidth="0.5" className="animate-pulse" />
                    <path 
                      d={`M ${x} ${y} L ${x - 1.5} ${y - 4.2} A 1.8 1.8 0 1 1 ${x + 1.5} ${y - 4.2} Z`} 
                      fill="#3b82f6" 
                      stroke="#fff" 
                      strokeWidth="0.3" 
                    />
                    <circle cx={x} cy={y - 4.2} r="0.7" fill="#fff" />
                  </g>
                );
              })()}
            </svg>

            {/* Hover Details Panel */}
            {hoveredDetails && (
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 border border-slate-700 p-2 rounded-lg text-xs flex items-center gap-2 shadow-xl backdrop-blur-sm z-[2000] animate-fade-in">
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-slate-200 font-mono tracking-wide truncate">{hoveredDetails}</span>
              </div>
            )}
          </div>
        )}

        {/* Legend Panel overlay (placed gracefully in map margins) */}
        <div className="absolute top-4 right-4 bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-[10px] space-y-2 font-mono flex flex-col gap-1 max-w-[170px] shadow-lg z-[2000]">
          <span className="text-slate-300 font-bold border-b border-slate-800 pb-1 mb-1 block uppercase">{t('mapLegendsTitle')}</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block border border-black/40"></span>
            <span className="text-slate-300">{t('mapLegend_openShelter')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block border border-black/40"></span>
            <span className="text-slate-300">{t('mapLegend_fullShelter')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2 bg-red-500 inline-block border border-black/30" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></span>
            <span className="text-slate-300">{t('mapLegend_critIncident')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2 bg-orange-500 inline-block border border-black/30" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></span>
            <span className="text-slate-300">{t('mapLegend_medIncident')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border border-dashed border-rose-500/80 rounded-full inline-block animate-pulse relative">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-rose-500 w-1.5 h-1.5 rounded-full"></span>
            </span>
            <span className="text-slate-300">{t('mapLegend_sosSignal')}</span>
          </div>
          <div className="flex items-center gap-2 animate-bounce">
            <span className="w-3.5 h-3.5 border border-blue-400 relative inline-block rounded-md bg-blue-500 text-[8px] text-center text-white font-bold inline-flex items-center justify-center">
              📍
            </span>
            <span className="text-slate-300 font-bold">{t('mapLegend_chosenPin')}</span>
          </div>
        </div>

        {/* Floating Instruction Banner */}
        <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-md p-2.5 rounded border border-slate-800 text-[10px] space-y-1 max-w-[190px] shadow z-[2000]">
          <p className="text-sky-400 font-mono font-bold leading-none uppercase">{t('mapSubTipTitle')}</p>
          <p className="text-slate-400 font-light leading-normal">
            {mapMode === 'real'
              ? (lang === 'vi' ? 'Nhấp chuột vào bất cứ tuyến đường hay quận huyện nào trên Việt Nam để chọn vị trí sự cố.' : 'Click anywhere directly on the real map of Vietnam to set incident alert location.')
              : t('mapSubTipDesc')
            }
          </p>
        </div>
      </div>

      {/* Selected coordinate summary footer bar */}
      {selectedLocation && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono z-[2000]">
          <span className="text-sky-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-bold">{lang === 'vi' ? 'ĐỊA CHỈ THỰC ĐỊA:' : 'LIVE GPS LOCATION:'}</span>
          </span>
          <span className="text-slate-200 font-semibold truncate max-w-full md:max-w-[480px] bg-slate-950 border border-slate-800 px-2 py-1 rounded select-all font-mono">
            {selectedLocation.address}
          </span>
        </div>
      )}
    </div>
  );
}
