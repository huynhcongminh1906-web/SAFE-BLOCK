/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DisasterCategory = 'flood' | 'storm' | 'fire' | 'landslide' | 'earthquake' | 'other';
export type IncidentStatus = 'pending' | 'verified' | 'rejected' | 'resolved';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type SOSStatus = 'active' | 'responding' | 'rescued';
export type UserRole = 'resident' | 'volunteer' | 'rescue' | 'leader' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  isVulnerable: boolean;
  vulnerabilityType?: string;
  location?: { lat: number; lng: number };
}

export interface Verification {
  userId: string;
  userName: string;
  userRole: UserRole;
  vote: 'confirm' | 'reject';
  comment?: string;
  timestamp: string;
  evidenceImage?: string;
}

export interface IncidentComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  category: DisasterCategory;
  title: string;
  description: string;
  location: { lat: number; lng: number; address?: string };
  status: IncidentStatus;
  severity: SeverityLevel;
  aiRiskScore: number; // 0-100
  aiAnalysis?: {
    isFakeReport: boolean;
    reasoning: string;
    confidence: number;
    appropriateAction: string;
  };
  createdAt: string;
  updatedAt: string;
  image?: string; // base64 or standard asset string
  verifications: Verification[];
  comments: IncidentComment[];
}

export interface SOSSignal {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  phone: string;
  message: string;
  location: { lat: number; lng: number };
  isVulnerable: boolean;
  vulnerabilityType?: string;
  status: SOSStatus;
  respondedBy?: string;
  respondedByPhone?: string;
  createdAt: string;
}

export interface Shelter {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  capacity: number;
  occupied: number;
  status: 'open' | 'full' | 'closed';
  amenities: string[];
  contact: string;
  address: string;
}

export interface BroadcastMessage {
  id: string;
  senderName: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  createdAt: string;
}

export interface AppStateData {
  users: UserProfile[];
  incidents: Incident[];
  sosSignals: SOSSignal[];
  shelters: Shelter[];
  broadcasts: BroadcastMessage[];
}
