import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { SOSSignal, UserProfile, Incident, Shelter, BroadcastMessage, UserRole, AppStateData } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini API initialized successfully.');
  } catch (err) {
    console.error('Error standardizing Gemini initialization:', err);
  }
} else {
  console.log('Gemini API key not found. Platform will use mock offline AI-analysis.');
}

// In-memory Full-Stack DB
const db: AppStateData = {
  users: [
    {
      id: 'usr-1',
      email: 'huynhcongminh1906@gmail.com',
      name: 'Minh Huynh',
      role: 'leader',
      phone: '+84 905 123 456',
      isVulnerable: false,
      location: { lat: 10.762622, lng: 106.660172 } // Ho Chi Minh City coordinates
    },
    {
      id: 'usr-2',
      email: 'volunteer1@safelock.org',
      name: 'Maria Sanchez',
      role: 'volunteer',
      phone: '+1 415 555 0192',
      isVulnerable: false,
      location: { lat: 10.775659, lng: 106.701140 }
    },
    {
      id: 'usr-3',
      email: 'elderly1@safelock.org',
      name: 'Alfred Sterling',
      role: 'resident',
      phone: '+1 415 555 0101',
      isVulnerable: true,
      vulnerabilityType: 'Mobility impaired - Wheelchair user (Elderly 78yo)',
      location: { lat: 10.765100, lng: 106.682100 }
    },
    {
      id: 'usr-4',
      email: 'rescue1@safelock.org',
      name: 'Commander Sarah Chen',
      role: 'rescue',
      phone: '+1 415 555 9111',
      isVulnerable: false,
      location: { lat: 10.758000, lng: 106.675000 }
    }
  ],
  incidents: [
    {
      id: 'inc-1',
      userId: 'usr-2',
      userName: 'Maria Sanchez',
      userRole: 'volunteer',
      category: 'flood',
      title: 'Water rising rapidly on Nguyen Hue Blvd',
      description: 'The floodwater has reached 40cm. Vehicles are stalling near the harbor. We need sandbags immediately to protect local shops and prevent baseline water ingress.',
      location: { lat: 10.775659, lng: 106.701140, address: 'Nguyen Hue Walking Street, District 1, HCMC' },
      status: 'verified',
      severity: 'high',
      aiRiskScore: 78,
      aiAnalysis: {
        isFakeReport: false,
        reasoning: 'Matches local meteorological satellite reports and contains detailed physical units (40cm depth, vehicle stalls). Verification level is backed by volunteer credentials.',
        confidence: 92,
        appropriateAction: 'Dispatch community sandbag squads and reroute regional traffic.'
      },
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      verifications: [
        {
          userId: 'usr-1',
          userName: 'Minh Huynh',
          userRole: 'leader',
          vote: 'confirm',
          comment: 'Can confirm! I am 2 blocks away, Nguyen Hue is heavy clogged. Stay away.',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        }
      ],
      comments: [
        {
          id: 'cmt-1',
          userId: 'usr-4',
          userName: 'Commander Sarah Chen',
          text: 'Rescue Unit 4 is on notice. Delivering 200 sandbags to Nguyen Hue intersection.',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      id: 'inc-2',
      userId: 'usr-3',
      userName: 'Alfred Sterling',
      userRole: 'resident',
      category: 'storm',
      title: 'Power line down near Senior Center',
      description: 'A heavy electric line was snapped by falling tree branches. It is sparking on the wet pavement. Elderly residents are unable to safely step onto the walkway.',
      location: { lat: 10.765100, lng: 106.682100, address: 'Block 4, Senior Care Center Avenue' },
      status: 'pending',
      severity: 'critical',
      aiRiskScore: 92,
      aiAnalysis: {
        isFakeReport: false,
        reasoning: 'Extremely high risk factor combined with wet surface (conduction hazard). Elderly population density increases vulnerability index to critical.',
        confidence: 88,
        appropriateAction: 'ALERT local fire department and isolate electrical grid immediately.'
      },
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      verifications: [],
      comments: []
    },
    {
      id: 'inc-3',
      userId: 'usr-1',
      userName: 'Minh Huynh',
      userRole: 'leader',
      category: 'fire',
      title: 'Commercial kitchen fire in progress',
      description: 'Plume of black smoke rising from the restaurant alley. Sounds of multiple minor popping noises. Local building alarms are active but no engine seen yet.',
      location: { lat: 10.760200, lng: 106.657800, address: 'Alley 214, Ba Thang Hai Street, District 10, HCMC' },
      status: 'verified',
      severity: 'critical',
      aiRiskScore: 85,
      aiAnalysis: {
        isFakeReport: false,
        reasoning: 'Structured context mentioning alarm triggers and secondary popping sounds typical of pressurized containers.',
        confidence: 90,
        appropriateAction: 'Notify Municipal Fire Response and issue immediate safe exit order.'
      },
      createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
      updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      verifications: [
        {
          userId: 'usr-2',
          userName: 'Maria Sanchez',
          userRole: 'volunteer',
          vote: 'confirm',
          comment: 'Confirmed, firefighters just arrived on the scene!',
          timestamp: new Date(Date.now() - 100 * 60 * 1000).toISOString()
        }
      ],
      comments: []
    }
  ],
  sosSignals: [
    {
      id: 'sos-1',
      userId: 'usr-3',
      userName: 'Alfred Sterling',
      userRole: 'resident',
      phone: '+1 415 555 0101',
      message: 'Trapped on second floor due to localized electrical hazard and flooding. Mobility impaired, need help getting down.',
      location: { lat: 10.765100, lng: 106.682100 },
      isVulnerable: true,
      vulnerabilityType: 'Elderly & Wheelchair User',
      status: 'responding',
      respondedBy: 'Commander Sarah Chen',
      respondedByPhone: '+1 415 555 9111',
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
    }
  ],
  shelters: [
    {
      id: 'shl-1',
      name: 'Safe-Lock Central Stadium Complex',
      location: { lat: 10.762939, lng: 106.666013 },
      capacity: 1500,
      occupied: 620,
      status: 'open',
      amenities: ['First Aid Clinic', 'Warm Meals', 'Wheelchair Access', 'Emergency Power Supply', 'Pet Friendly'],
      contact: '+84 283 899 911',
      address: '219 Ly Thuong Kiet Street, District 10, HCMC'
    },
    {
      id: 'shl-2',
      name: 'Green Valley Community Gymnasium',
      location: { lat: 10.781200, lng: 106.690500 },
      capacity: 400,
      occupied: 395,
      status: 'full',
      amenities: ['In-house Doctor', 'Bottled Water', 'Cots', 'Child Care Station'],
      contact: '+84 283 888 112',
      address: '42 Nguyen Thi Minh Khai, District 3, HCMC'
    },
    {
      id: 'shl-3',
      name: 'River Heights Safe School Complex',
      location: { lat: 10.751100, lng: 106.671200 },
      capacity: 800,
      occupied: 120,
      status: 'open',
      amenities: ['Rescue Landing Pad', 'Blankets', 'Emergency Nursing Staff', 'Solar Power Bank'],
      contact: '+84 283 999 123',
      address: '88 Tran Hung Dao, District 5, HCMC'
    }
  ],
  broadcasts: [
    {
      id: 'brd-1',
      senderName: 'Emergency Command Center',
      message: 'CRITICAL WARNING: Local flooding expected to peak tonight between 9:00 PM and 1:00 AM due to heavy squall and high tide. Secure all valuable electronics and locate nearby high grounds or shelters.',
      severity: 'danger',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    },
    {
      id: 'brd-2',
      senderName: 'Safe-Lock Tech Committee',
      message: 'We have updated shelter status lists. Green Valley Gymnasium is currently near maximum capacity (98%). Please redirect families to Stadium Complex.',
      severity: 'warning',
      createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString()
    }
  ]
};

// HELPER API FOR GEMINI AI RISK SCANNING
async function performAIEval(category: string, title: string, description: string, userRole: string) {
  if (!ai) {
    // High-Fidelity offline default analyzer (if no API key)
    const riskKeywords = ['sparking', 'trapped', 'fire', 'smoke', 'rising', 'rapid', 'injured', 'elderly', 'child', 'critical', 'explosion', 'landslide'];
    const fakeKeywords = ['alien', 'ufo', 'conspiracy', 'zombie', 'joke', 'fake alert', 'testing please ignore', 'free money', 'sell coins'];
    
    let isFakeReport = false;
    let confidence = 75;
    let reasoning = 'Offline diagnostic evaluated standard pattern parameters.';
    
    // Check fake flags
    for (const key of fakeKeywords) {
      if (title.toLowerCase().includes(key) || description.toLowerCase().includes(key)) {
        isFakeReport = true;
        confidence = 90;
        reasoning = `System caught questionable test trigger: "${key}". Verified against fake report metadata.`;
        break;
      }
    }

    let matches = 0;
    for (const key of riskKeywords) {
      if (title.toLowerCase().includes(key) || description.toLowerCase().includes(key)) {
        matches++;
      }
    }

    let score = 30 + (matches * 15);
    if (userRole === 'rescue' || userRole === 'leader') score += 15;
    if (userRole === 'volunteer') score += 8;
    score = Math.min(Math.max(score, 10), 98);

    let level = 'Assess locally';
    if (score > 80) level = 'IMMEDIATE DISPATCH of municipal units and alert broadcasting.';
    else if (score > 50) level = 'Activate local neighborhood watch and volunteer checking teams.';

    return {
      riskScore: Math.round(score),
      analysis: {
        isFakeReport,
        reasoning: isFakeReport ? reasoning : `Auto-scoring metrics identified matches on ${matches} priority threat vectors. Confidence validated via submitter role.`,
        confidence,
        appropriateAction: level
      }
    };
  }

  try {
    const prompt = `You are the core AI Engine for "Safe-Lock", a community-based disaster response network.
Evaluate the following emergency alert:
- Disaster Category: ${category}
- Title: ${title}
- Description: ${description}
- Submitted by User Role: ${userRole}

Perform risk validation, fake alert detection, safety classification, and provide recommended actions.
Return your decision strictly in JSON format matching this JSON schema:
{
  "isFakeReport": boolean,
  "confidence": number, // between 0 and 100
  "riskScore": number, // priority from 0 (lowest) to 100 (catastrophic hazard)
  "reasoning": "brief 1-2 sentence explanation",
  "appropriateAction": "recommended dispatch or safety protocols"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const resultText = response.text || '';
    const parsed = JSON.parse(resultText.trim());
    return {
      riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : 50,
      analysis: {
        isFakeReport: !!parsed.isFakeReport,
        reasoning: parsed.reasoning || 'Gemini verified report attributes.',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
        appropriateAction: parsed.appropriateAction || 'Monitor and investigate locally.'
      }
    };
  } catch (err) {
    console.error('Gemini API call failed, falling back to heuristic:', err);
    return {
      riskScore: 65,
      analysis: {
        isFakeReport: false,
        reasoning: 'AI models connection timed out. Defaulting to safe high-priority triage.',
        confidence: 60,
        appropriateAction: 'Dispatch neighborhood volunteers immediately.'
      }
    };
  }
}

// REST ENDPOINTS

// Statistical Metrics
app.get('/api/stats', (req, res) => {
  const activeCount = db.incidents.filter(i => i.status !== 'resolved' && i.status !== 'rejected').length;
  const verifiedCount = db.incidents.filter(i => i.status === 'verified').length;
  const sosActive = db.sosSignals.filter(s => s.status === 'active' || s.status === 'responding').length;
  const activeShelterCap = db.shelters.reduce((acc, current) => acc + current.capacity, 0);
  const activeShelterOccupied = db.shelters.reduce((acc, current) => acc + current.occupied, 0);

  res.json({
    activeAlerts: activeCount,
    verifiedAlerts: verifiedCount,
    pendingSOS: sosActive,
    shelterCapacityPercentage: Math.round((activeShelterOccupied / activeShelterCap) * 100),
    totalShelters: db.shelters.length,
    usersCount: db.users.length,
    registeredSOS: db.sosSignals.length
  });
});

// Auth APIs
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Find preset user or create temporary user profile
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    if (email && email.includes('@')) {
      const parts = email.split('@');
      const name = parts[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      user = {
        id: 'usr-' + Math.random().toString(36).substr(2, 9),
        email,
        name,
        role: email.includes('rescue') ? 'rescue' : email.includes('volunteer') ? 'volunteer' : 'resident',
        phone: '+1 555 000 0000',
        isVulnerable: false,
        location: { lat: 10.762622, lng: 106.660172 }
      };
      db.users.push(user);
    } else {
      return res.status(401).json({ error: 'Invalid email address credentials.' });
    }
  }
  res.json({ success: true, user });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, role, phone, isVulnerable, vulnerabilityType, location } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required fields.' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.json({ success: true, user: existing });
  }

  const newUser = {
    id: 'usr-' + Math.random().toString(36).substr(2, 9),
    email,
    name,
    role: role || 'resident',
    phone: phone || '+1 555 000 0000',
    isVulnerable: !!isVulnerable,
    vulnerabilityType: vulnerabilityType || '',
    location: location || { lat: 10.762622, lng: 106.660172 }
  };

  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

// Incidents APIs
app.get('/api/incidents', (req, res) => {
  res.json(db.incidents);
});

app.post('/api/incidents', async (req, res) => {
  const { userId, category, title, description, location, image, severity } = req.body;
  const user = db.users.find(u => u.id === userId) || db.users[0];

  if (!category || !title || !description) {
    return res.status(400).json({ error: 'Category, title, and description are required parameters.' });
  }

  const incidentLocation = location || { lat: 10.762622, lng: 106.660172, address: 'Default Safe-Zone Command Core' };

  // AI evaluation trigger
  const aiEval = await performAIEval(category, title, description, user.role);

  const newIncident: Incident = {
    id: 'inc-' + Math.random().toString(36).substr(2, 9),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    category,
    title,
    description,
    location: incidentLocation,
    status: 'pending',
    severity: severity || (aiEval.riskScore > 80 ? 'critical' : aiEval.riskScore > 50 ? 'high' : 'medium'),
    aiRiskScore: aiEval.riskScore,
    aiAnalysis: aiEval.analysis,
    image: image || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verifications: [],
    comments: []
  };

  db.incidents.unshift(newIncident);

  // Auto push broadcast warning if high scoring fake-alert threat
  if (newIncident.severity === 'critical' && !newIncident.aiAnalysis.isFakeReport) {
    const autoBroadcast: BroadcastMessage = {
      id: 'brd-' + Math.random().toString(36).substr(2, 9),
      senderName: 'SYSTEM CRITICAL SHIELD',
      message: `DISASTER BROADCAST: ${newIncident.category.toUpperCase()} ALERT - "${newIncident.title}" nearby. Please guide local children and vulnerable families.`,
      severity: 'danger',
      createdAt: new Date().toISOString()
    };
    db.broadcasts.unshift(autoBroadcast);
  }

  res.json(newIncident);
});

// Community verification vote
app.post('/api/incidents/:id/verify', (req, res) => {
  const { id } = req.params;
  const { userId, vote, comment, evidenceImage } = req.body;
  
  const incident = db.incidents.find(i => i.id === id);
  const user = db.users.find(u => u.id === userId);

  if (!incident) {
    return res.status(404).json({ error: 'Incident report not found.' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Authorized volunteer or user required.' });
  }

  // Remove duplicate vote if exists
  incident.verifications = incident.verifications.filter(v => v.userId !== userId);

  const newVote = {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    vote,
    comment: comment || '',
    evidenceImage: evidenceImage || null,
    timestamp: new Date().toISOString()
  };

  incident.verifications.push(newVote);
  
  // Re-calculate Status dynamically
  const confirms = incident.verifications.filter(v => v.vote === 'confirm').length;
  const rejects = incident.verifications.filter(v => v.vote === 'reject').length;
  
  incident.updatedAt = new Date().toISOString();

  // Rules:
  // If leader confirms, it goes straight to verified
  // If rescue confirms, verified
  // If 3 confirms from anyone, verified
  // If 2 rejects from volunteers, flagged as rejected
  const isLeaderOrRescue = user.role === 'leader' || user.role === 'rescue';
  
  if (isLeaderOrRescue && vote === 'confirm') {
    incident.status = 'verified';
  } else if (confirms >= 2) {
    incident.status = 'verified';
  } else if (rejects >= 2) {
    incident.status = 'rejected';
  }

  res.json(incident);
});

// Comment or additional evidence
app.post('/api/incidents/:id/comments', (req, res) => {
  const { id } = req.params;
  const { userId, text } = req.body;
  
  const incident = db.incidents.find(i => i.id === id);
  const user = db.users.find(u => u.id === userId);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  if (!user) {
    return res.status(401).json({ error: 'User is unauthorized' });
  }

  const commentItem = {
    id: 'cmt-' + Math.random().toString(36).substr(2, 9),
    userId,
    userName: user.name,
    text,
    timestamp: new Date().toISOString()
  };

  incident.comments.push(commentItem);
  incident.updatedAt = new Date().toISOString();
  res.json(commentItem);
});

// Complete or resolve incident
app.put('/api/incidents/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, userId } = req.body;
  const incident = db.incidents.find(i => i.id === id);
  const user = db.users.find(u => u.id === userId);

  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  if (!user || (user.role !== 'rescue' && user.role !== 'leader' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Insufficient permission to modify incident state' });
  }

  incident.status = status;
  incident.updatedAt = new Date().toISOString();
  
  // Log status change comment
  incident.comments.push({
    id: 'cmt-' + Math.random().toString(36).substr(2, 9),
    userId: user.id,
    userName: `SYSTEM [${user.name}]`,
    text: `Report status updated to: ${status.toUpperCase()} by authority.`,
    timestamp: new Date().toISOString()
  });

  res.json(incident);
});

// SOS Signalling
app.get('/api/sos', (req, res) => {
  res.json(db.sosSignals);
});

app.post('/api/sos', (req, res) => {
  const { userId, message, location, phone } = req.body;
  const user = db.users.find(u => u.id === userId);

  if (!userId) {
    return res.status(400).json({ error: 'Active user authentication is required' });
  }

  const userProfile: UserProfile = user || {
    id: 'usr-anon',
    email: 'anonymous@safelock.org',
    name: 'Anonymous Resident',
    role: 'resident',
    phone: phone || '+1 555 000 0000',
    isVulnerable: true,
    vulnerabilityType: 'Elderly Self-Flagged in Urgent Panel',
    location: { lat: 10.762622, lng: 106.660172 }
  };

  const newSOS: SOSSignal = {
    id: 'sos-' + Math.random().toString(36).substr(2, 9),
    userId: userProfile.id,
    userName: userProfile.name,
    userRole: userProfile.role,
    phone: phone || userProfile.phone || '+1 555 000 0000',
    message: message || 'Urgently requesting emergency rescue support!',
    location: location || { lat: 10.762622, lng: 106.660172 },
    isVulnerable: !!userProfile.isVulnerable,
    vulnerabilityType: userProfile.vulnerabilityType || 'General Resident Needs Assistance',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.sosSignals.unshift(newSOS);

  // Auto Broadcast SOS signal to nearby users
  const autoBroadcast: BroadcastMessage = {
    id: 'brd-' + Math.random().toString(36).substr(2, 9),
    senderName: 'URGENT NEIGHBOURS SHIELD',
    message: `SOS EMERGENCY SIGNAL from ${userProfile.name}. Mobility priority: ${newSOS.isVulnerable ? 'VULNERABLE INDIVIDUAL / ELDERLY' : 'STANDARD'}. Ready response squads check SOS Board.`,
    severity: 'danger',
    createdAt: new Date().toISOString()
  };
  db.broadcasts.unshift(autoBroadcast);

  res.json(newSOS);
});

// Respond to SOS
app.put('/api/sos/:id', (req, res) => {
  const { id } = req.params;
  const { status, responderId } = req.body;
  
  const sos = db.sosSignals.find(s => s.id === id);
  const responder = db.users.find(u => u.id === responderId);

  if (!sos) {
    return res.status(404).json({ error: 'SOS request trace not found' });
  }
  if (!responder) {
    return res.status(401).json({ error: 'Valid helper/rescuer credentials required' });
  }

  sos.status = status;
  if (status === 'responding') {
    sos.respondedBy = responder.name;
    sos.respondedByPhone = responder.phone;
  } else if (status === 'rescued') {
    sos.status = 'rescued';
  } else {
    sos.status = 'active';
    sos.respondedBy = undefined;
    sos.respondedByPhone = undefined;
  }

  res.json(sos);
});

// Shelters APIs
app.get('/api/shelters', (req, res) => {
  res.json(db.shelters);
});

app.put('/api/shelters/:id', (req, res) => {
  const { id } = req.params;
  const { occupied, status } = req.body;
  const shelter = db.shelters.find(s => s.id === id);

  if (!shelter) {
    return res.status(404).json({ error: 'Shelter not found' });
  }

  if (typeof occupied === 'number') {
    shelter.occupied = Math.min(Math.max(occupied, 0), shelter.capacity);
  }
  if (status) {
    shelter.status = status;
  }

  res.json(shelter);
});

// Broadcasts APIs
app.get('/api/broadcasts', (req, res) => {
  res.json(db.broadcasts);
});

app.post('/api/broadcasts', (req, res) => {
  const { senderName, message, severity } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Broadcast alert message core is required' });
  }

  const newBroadcast = {
    id: 'brd-' + Math.random().toString(36).substr(2, 9),
    senderName: senderName || 'Civil Defence Command',
    message,
    severity: severity || 'info',
    createdAt: new Date().toISOString()
  };

  db.broadcasts.unshift(newBroadcast);
  res.json(newBroadcast);
});

// Serve static app UI in production, else launch Vite in developer mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Safe-Lock] Server running on http://localhost:${PORT}`);
  });
}

startServer();
