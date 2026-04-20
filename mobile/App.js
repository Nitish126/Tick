import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, ActivityIndicator, TextInput, Modal, Dimensions, LayoutAnimation, Platform, UIManager, Alert, KeyboardAvoidingView, Switch } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Car, DollarSign, Wrench, AlertTriangle, FileText, X, Edit2, Droplet, Filter, Wind, Thermometer, Disc, RefreshCcw, Zap, BatteryCharging, CloudRain, Check, CarFront, Activity, ShieldCheck, ChevronRight, Fuel, Wrench as WrenchIcon, Camera as CameraIcon, MapPin, Calendar, Clock, Users, User, ArrowRight, Trash2, Menu, Plus, LogOut, TriangleAlert } from 'lucide-react-native';

const GATEWAY_URL = 'https://tick-production-2e45.up.railway.app';
const APP_VERSION = 'v1.0.6-resilience';
const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const C = {
  bg: '#F5F7FA', bgDark: '#000000', text: '#0F172A', textSub: '#64748B', white: '#FFFFFF',
  border: '#E2E8F0', blueDark: '#0B1120', bluePrimary: '#2563EB', 
  blueLight: '#DBEAFE', redLight: '#FEE2E2', redPrimary: '#DC2626',
  grayLight: '#F1F5F9', green: '#16A34A', mwu: '#8B5CF6',
  luxuryCard: '#12141D', luxuryBorder: 'rgba(37,99,235,0.4)', silver: '#94A3B8'
};

const SERVICE_GRID = {
   REGULAR: [
      { id: 'Oil Change', icon: Droplet },
      { id: 'Oil Filter', icon: Filter },
      { id: 'Air Filter', icon: Wind },
      { id: 'Coolant Flush', icon: Thermometer },
      { id: 'Brake Fluid', icon: Disc },
      { id: 'Tyre Rotation', icon: RefreshCcw },
      { id: 'Spark Plugs', icon: Zap },
      { id: 'Battery Work', icon: BatteryCharging },
      { id: 'Wiper Blades', icon: CloudRain },
      { id: 'Cabin Filter', icon: Wind },
      { id: 'Hoses / Belts', icon: Activity },
      { id: 'Transmission', icon: WrenchIcon }
   ],
   MISC: [
      { id: 'Wheel Alignment', icon: RefreshCcw },
      { id: 'Balancing', icon: Disc },
      { id: 'Tyre Purchase', icon: Zap },
      { id: 'Suspension', icon: Activity },
      { id: 'Puncture Fix', icon: AlertTriangle },
      { id: 'Bulb Replace', icon: Zap },
      { id: 'Detailing Wash', icon: Droplet },
      { id: 'Misc Repair', icon: WrenchIcon }
   ]
};

const generateUUID = () => Math.random().toString(36).substring(2, 10);

// ── Premium Showroom Assets (Light & Dark Variants) ─────────────────────────
const CAR_IMAGES = {
  'Seltos': {
    dark:  require('./assets/cars/seltos_midnight.png'),
    light: require('./assets/cars/seltos_white.png'),
  },
  'Creta': {
    dark:  require('./assets/cars/creta_midnight.png'),
    light: require('./assets/cars/creta_white.png'),
  },
  'XUV700': {
    dark:  require('./assets/cars/xuv700_midnight.png'),
    light: require('./assets/cars/xuv700_white.png'),
  },
  'Dzire': {
    dark:  require('./assets/cars/dzire_midnight.png'),
    light: require('./assets/cars/dzire_white.png'),
  },
  'Swift': {
    dark:  require('./assets/cars/swift_midnight.png'),
    light: require('./assets/cars/swift_white.png'),
  },
  'Nexon': {
    dark:  require('./assets/cars/nexon_midnight.png'),
    light: require('./assets/cars/nexon_white.png'),
  },
};

const MANUFACTURER_LOGOS = {
  'Kia':      require('./assets/logos/kia.png'),
  'Hyundai':  require('./assets/logos/hyundai.png'),
  'Mahindra': require('./assets/logos/mahindra.png'),
  'Maruti':   require('./assets/logos/maruti.png'),
  'Tata':     require('./assets/logos/tata.png'),
};

const getVehicleAsset = (make, model, isDark) => {
  if (!model) return null;
  const m = model.trim().toLowerCase();
  const mk = make.trim().toLowerCase();
  
  // 1. Try to find the specific car model image
  const cardKey = Object.keys(CAR_IMAGES).find(k => m.includes(k.toLowerCase()));
  if (cardKey) {
    return { type: 'IMAGE', source: isDark ? CAR_IMAGES[cardKey].dark : CAR_IMAGES[cardKey].light };
  }
  
  // 2. Fallback to Manufacturer Logo
  const logoKey = Object.keys(MANUFACTURER_LOGOS).find(k => mk.includes(k.toLowerCase()) || m.includes(k.toLowerCase()));
  if (logoKey) {
    return { type: 'LOGO', source: MANUFACTURER_LOGOS[logoKey] };
  }
  
  return null;
};
// ──────────────────────────────────────────────────────────────────────────

function MotoKeeperApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [overlay, setOverlay] = useState(null); 
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [myUserId, setMyUserId] = useState('Loading...');
  const [loginId, setLoginId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [history, setHistory] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState([]);
  
  // Dashboard Filters
  const [cameraMode, setCameraMode] = useState('BILL'); // BILL or DOC
  const [targetDocType, setTargetDocType] = useState(null); // RC, INSURANCE, PUC
  
  const [reminders, setReminders] = useState({ wiper: false, spare: false, cabin: false });
  const [batteryExp, setBatteryExp] = useState('');
  const [fleetDocuments, setFleetDocuments] = useState([]);
  const [fleetHealth, setFleetHealth] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState({});

  const [filterV, setFilterV] = useState('ALL');
  const [filterC, setFilterC] = useState('ALL');

  const [activeVehicleId, setActiveVehicleId] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [deepVehicleData, setDeepVehicleData] = useState(null);
  const [collaboratorId, setCollaboratorId] = useState("");

  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const [photoBase64, setPhotoBase64] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [scanOdo, setScanOdo] = useState(""); // Sync scanned odometer
  
  const [manualForm, setManualForm] = useState({ amount: '', merchant: '', category: 'FUEL', date: new Date().toISOString().split('T')[0], odometer: '' });
  const [manualPhoto, setManualPhoto] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [repairTab, setRepairTab] = useState('REGULAR');

  const [newBrand, setNewBrand] = useState("Kia");
  const [newModel, setNewModel] = useState("Seltos");
  const [newColor, setNewColor] = useState("#0B1120");
  const [newOdo, setNewOdo] = useState("0");
  const [newVin, setNewVin] = useState("DL-01-XXXX");
  const [editingVehicleId, setEditingVehicleId] = useState(null);

  const switchTab = (tab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  useEffect(() => { 
    initAuthAndFetch(); 
    prepareNotifications();
  }, []);

  const prepareNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    setPushEnabled(finalStatus === 'granted');
  };

  const triggerLocalNotification = async (title, body, vehicleId) => {
    // Basic throttle: Don't notify for the same car/reason more than once an hour
    const now = Date.now();
    const key = `${vehicleId}_${title}`;
    if (lastNotificationTime[key] && now - lastNotificationTime[key] < 3600000) return;

    await Notifications.scheduleNotificationAsync({
      content: { title: `MotoKeeper: ${title}`, body },
      trigger: null,
    });
    setLastNotificationTime(prev => ({ ...prev, [key]: now }));
  };

  const initAuthAndFetch = async () => {
    let id = await AsyncStorage.getItem('MOTO_USER_ID');
    // FAIL-PROOF: If no ID stored, restore the original owner ID which has all the data
    if (!id) {
       id = 'user-mc0gouip'; // Original owner ID with 3 cars (DL12CW5817, DL8CAV6142, DL-01-XXXX)
       await AsyncStorage.setItem('MOTO_USER_ID', id);
    }
    setMyUserId(id);
    setLoginId(id);
    Alert.alert("MotoKeeper Sync", `Active ID: ${id}`);
    axios.defaults.headers.common['x-user-id'] = id;
    fetchData();
  };

  const groupDataByDate = (ledgers) => {
    if (!ledgers || ledgers.length === 0) return [];
    
    const todayStr = new Date().toLocaleDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toLocaleDateString();

    const groups = { "Today": [], "Yesterday": [], "Older": [] };
    
    ledgers.forEach(r => {
      const dStr = new Date(r.date).toLocaleDateString();
      if (dStr === todayStr) groups["Today"].push(r);
      else if (dStr === yestStr) groups["Yesterday"].push(r);
      else groups["Older"].push(r);
    });

    return Object.keys(groups).filter(k => groups[k].length > 0).map(k => ({ title: k, data: groups[k] }));
  };

  const fetchData = async () => {
    try {
      const vRes = await axios.get(`${GATEWAY_URL}/api/vehicles/my-fleet`);
      setVehicles(vRes.data.data || []);
      const hRes = await axios.get(`${GATEWAY_URL}/api/expenses/all`);
      setHistory(hRes.data.data || []);
    } catch (e) { console.log("Fetch error:", e.message); }
  };

  const hexToRgba = (hex, opacity) => {
     if (!hex) return `rgba(0,0,0,${opacity})`;
     hex = hex.replace('#', '');
     if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
     const r = parseInt(hex.slice(0, 2), 16);
     const g = parseInt(hex.slice(2, 4), 16);
     const b = parseInt(hex.slice(4, 6), 16);
     return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Live filtering effect
  const [dashboardMetrics, setDashboardMetrics] = useState({ total: 0, fuel: 0, service: 0, count: 0 });

  useEffect(() => {
     let filtered = history;
     if (filterV !== 'ALL') filtered = filtered.filter(h => h.vehicleId === filterV);
     if (filterC !== 'ALL') {
        filtered = filtered.filter(h => {
           const fullText = (h.merchant + ' ' + (h.lineItems || '')).toUpperCase();
           
           if (filterC === 'FUEL' && (fullText.includes('FUEL') || fullText.includes('PETROL') || fullText.includes('DIESEL') || fullText.includes('PUMP'))) return true;
           if (filterC === 'SERVICE' && (fullText.includes('SERVICE') || fullText.includes('REPAIR') || fullText.includes('MAINTENANCE') || fullText.includes('PLUG') || fullText.includes('OIL') || fullText.includes('WASH'))) return true;
           if (filterC === 'TYRES' && (fullText.includes('TYRE') || fullText.includes('WHEEL') || fullText.includes('ALIGNMENT'))) return true;
           
           // Strict fallback for manual tags
           const firstTag = h.lineItems ? (Array.isArray(h.lineItems) ? h.lineItems : JSON.parse(h.lineItems))[0].description.toUpperCase() : '';
           if (filterC === 'FUEL' && firstTag === 'FUEL') return true;
           if (filterC === 'SERVICE' && firstTag === 'REPAIR') return true;
           
           return false;
        });
     }

     // Calculate metrics dynamically
     let total = 0, fuel = 0, service = 0;
     filtered.forEach(h => {
        total += h.amount;
        const tag = h.lineItems ? (Array.isArray(h.lineItems) ? h.lineItems : JSON.parse(h.lineItems))[0].description.toUpperCase() : '';
        const fullTxt = (h.merchant + ' ' + tag).toUpperCase();
        if (tag === 'FUEL' || fullTxt.includes('FUEL') || fullTxt.includes('PETROL') || fullTxt.includes('DIESEL') || fullTxt.includes('PUMP')) fuel += h.amount;
        else if (tag === 'REPAIR' || fullTxt.includes('SERVICE') || fullTxt.includes('REPAIR') || fullTxt.includes('MAINTENANCE')) service += h.amount;
     });
     setDashboardMetrics({ total, fuel, service, count: filtered.length });

     setGroupedHistory(groupDataByDate(filtered));
  }, [history, filterV, filterC]);

  useEffect(() => {
    if (vehicles.length > 0) {
      loadFleetIntelligence();
    }
  }, [vehicles, history]);

  const loadFleetIntelligence = async () => {
    try {
      const docRes = await axios.get(`${GATEWAY_URL}/api/documents/fleet/all`, { headers: { 'x-user-id': myUserId }});
      setFleetDocuments(docRes.data.data);
      
      // Compute Health & Maintenance logic
      const healthArray = vehicles.map(v => {
         const vHistory = history.filter(h => h.vehicleId === v.id);
         const alignMatch = vHistory.find(h => (h.merchant + (h.lineItems||'')).toUpperCase().includes('ALIGNMENT'));
         const lastAlign = alignMatch ? (alignMatch.odometer || 0) : 0;
         const distSinceAlign = v.odometer - lastAlign;
         
         const oilMatch = vHistory.find(h => (h.merchant + (h.lineItems||'')).toUpperCase().includes('OIL'));
         const lastOil = oilMatch ? (oilMatch.odometer || 0) : 0;
         const distSinceOil = v.odometer - lastOil;

         return {
            id: v.id,
            make: v.make,
            model: v.model,
            alignDue: distSinceAlign > 5000,
            oilDue: distSinceOil > 10000,
            score: Math.max(0, 100 - (distSinceAlign/100) - (distSinceOil/200))
         };
      });
      setFleetHealth(healthArray);

      // PROACTIVE ALERT ENGINE
      if (pushEnabled) {
        healthArray.forEach(vh => {
           if (vh.score < 50) {
              triggerLocalNotification("Fleet Health Warning", `${vh.make} ${vh.model} health is at ${Math.round(vh.score)}%. Service recommended.`, vh.id);
           }
           if (vh.oilDue) {
              triggerLocalNotification("Service Overdue", `Oil change is required for your ${vh.model}.`, vh.id);
           }
        });

        // Battery Warranty Check (Critical Alert)
        vehicles.forEach(v => {
           if (v.batteryWarrantyDate) {
              const daysLeft = Math.ceil((new Date(v.batteryWarrantyDate) - new Date()) / (1000 * 60 * 60 * 24));
              if (daysLeft > 0 && daysLeft <= 7) {
                 triggerLocalNotification("Warranty Expiring", `Battery warranty for ${v.registrationNo} expires in ${daysLeft} days.`, v.id);
              }
           }
        });
      }
    } catch (e) {
      console.error("Fleet intelligence error", e);
    }
  };

  const loadDeepVehicleLevel = async (vid) => {
    try {
      const res = await axios.get(`${GATEWAY_URL}/api/vehicles/${vid}`, { headers: { 'x-user-id': myUserId }});
      setDeepVehicleData(res.data.data);
    } catch (e) {
      console.error("Deep fetch error", e);
    }
  };

  const uploadDoc = async (type, title, base64) => {
    if (!selectedVehicle) return;
    setLoading(true);
    try {
      await axios.post(`${GATEWAY_URL}/api/documents/${selectedVehicle.id}`, {
        type, title, image_base64: base64
      }, { headers: { 'x-user-id': myUserId }});
      Alert.alert("Success", `${title} uploaded to vault.`);
      loadDeepVehicleLevel(selectedVehicle.id);
    } catch (e) {
      console.error("Upload error", e);
      Alert.alert("Error", "Failed to upload document.");
    } finally {
      setLoading(false);
    }
  };

  const shareVehicle = async () => {
    if (!collaboratorId || collaboratorId.length < 3) return Alert.alert("Error", "Invalid User ID");
    try {
      setLoading(true);
      const res = await axios.post(`${GATEWAY_URL}/api/vehicles/${selectedVehicle.id}/collaborators`, { collaboratorId });
      Alert.alert("Success", res.data.message || "Invited Successfully");
      setCollaboratorId("");
      loadDeepVehicleLevel(selectedVehicle.id); // reload networking list
    } catch (e) {
      Alert.alert("Failed", "Could not assign user to vehicle");
    } finally {
      setLoading(false);
    }
  };

  const handleEditInit = () => {
      setNewBrand(selectedVehicle.make);
      setNewModel(selectedVehicle.model);
      setNewColor(selectedVehicle.color);
      setNewOdo(selectedVehicle.odometer.toString() || "");
      setNewVin(selectedVehicle.registrationNo);
      setEditingVehicleId(selectedVehicle.id);
      setOverlay('ADD_VEHICLE');
  };

  const handleDeleteConfirm = () => {
    Alert.alert("Delete Vehicle", "This will permanently vault all linked expenses. Confirm?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
             setLoading(true);
             await axios.delete(`${GATEWAY_URL}/api/vehicles/${selectedVehicle.id}`);
             Alert.alert("Deleted", "Vehicle removed from Garage");
             setOverlay(null);
             fetchData();
          } catch(e) { Alert.alert("Error", "Could not delete"); }
          finally { setLoading(false); }
      }}
    ]);
  };

  const handleCreateVehicle = async () => {
    try {
      setLoading(true);
      if (editingVehicleId) {
         await axios.put(`${GATEWAY_URL}/api/vehicles/${editingVehicleId}`, { make: newBrand, model: newModel, color: newColor, odometer: newOdo, registrationNo: newVin });
         setEditingVehicleId(null);
         Alert.alert("Success", "Vehicle updated.");
      } else {
         await axios.post(`${GATEWAY_URL}/api/vehicles`, { make: newBrand, model: newModel, color: newColor, odometer: newOdo, registrationNo: newVin });
      }
      fetchData(); 
      setOverlay(null);
    } catch (e) { 
       const errorMsg = e.response?.data?.error || e.message || "Could not save vehicle.";
       Alert.alert("Error", errorMsg); 
    } 
    finally { setLoading(false); }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const data = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      const manipResult = await ImageManipulator.manipulateAsync(data.localUri || data.uri, [{ resize: { width: 800 } }], { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      
      if (cameraMode === 'DOC') {
         uploadDoc(targetDocType, targetDocType, manipResult.base64);
         setOverlay('GARAGE_DETAIL'); // Go back to vault
      } else if (overlay === 'MANUAL_CAMERA') {
         setManualPhoto(manipResult.base64);
         setOverlay('MANUAL_ENTRY');
      } else {
         setPhotoBase64(manipResult.base64);
         setOverlay('SCAN_RESULT');
      }
    }
  };

  const uploadAndScan = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${GATEWAY_URL}/api/expenses/scan`, { image_base64: photoBase64, vehicleId: activeVehicleId });
      setParsedData(response.data.data);
      setScanOdo(""); // reset ODO field
      // Don't refetch instantly. Wait until user appends their Odometer.
    } catch (err) { 
       if (err.response?.status === 429) {
          Alert.alert('Quota Reached', 'Gemini AI free-tier limit exceeded. Please wait a minute or moving to a paid tier for heavy testing.');
       } else {
          Alert.alert('Error', 'Failed to extract bill via AI API.'); 
       }
    } finally { setLoading(false); }
  };

  const finalizeScan = async () => {
     try {
        setLoading(true);
        if (scanOdo && scanOdo.trim() !== '') {
           await axios.patch(`${GATEWAY_URL}/api/expenses/${parsedData.dbId}`, { odometer: scanOdo });
        }
        await fetchData();
        setOverlay(null); 
        setParsedData(null); 
        setActiveTab('DASHBOARD');
     } catch (e) { Alert.alert('Error', 'Failed to append modifiers'); }
     finally { setLoading(false); }
  }

  const submitManualLog = async () => {
    try {
      setLoading(true);
      await axios.post(`${GATEWAY_URL}/api/expenses/manual`, { 
         ...manualForm, 
         vehicleId: activeVehicleId, 
         image_base64: manualPhoto,
         selectedServices: manualForm.category === 'REPAIR' ? selectedServices : [] 
      });
      fetchData();
      Alert.alert('Success', 'Log Vaulted Locally!');
      setOverlay(null);
      setActiveTab('DASHBOARD');
      setManualPhoto(null);
      setSelectedServices([]);
    } catch (err) { Alert.alert('Error', 'Failed to save log.'); }
    finally { setLoading(false); }
  };

  const toggleService = (srvId) => {
     if (selectedServices.includes(srvId)) {
        setSelectedServices(selectedServices.filter(s => s !== srvId));
     } else {
        setSelectedServices([...selectedServices, srvId]);
     }
  };

  const handleQuickScan = () => {
     if (vehicles.length === 0) return Alert.alert("Empty Garage", "Add your first vehicle!");
     if (filterV === 'ALL') {
         setOverlay('VEHICLE_PICKER');
     } else {
         setActiveVehicleId(filterV);
         setOverlay('CAMERA');
     }
  };

  return (
    <SafeAreaView style={[styles.root, {backgroundColor: isDarkMode ? '#000000' : C.bg}]}>
        
        {/* DASHBOARD ROUTING */}
        {activeTab === 'DASHBOARD' && (
          <View style={styles.canvas}>
             <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
                <TouchableOpacity onPress={() => setOverlay('COMMAND_CENTER')} style={{padding: 10, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.white, borderRadius: 14, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : C.border, marginRight: 15, shadowColor: C.blueDark, shadowOpacity: 0.05, shadowRadius: 10}}>
                   <Menu size={22} color={isDarkMode ? C.white : C.blueDark} />
                </TouchableOpacity>
                <Text style={[styles.headerHero, {color: isDarkMode ? C.white : C.blueDark, marginBottom: 0, marginTop: 0}]}>Dashboard</Text>
             </View>

             {/* AGGREGATED SPEND METRICS CARD */}
             <View style={[styles.metricsCard, isDarkMode && {backgroundColor: '#000000', borderColor: 'rgba(255,255,255,0.08)'}]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                   <View>
                      <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, marginBottom: 5}}>TOTAL LEDGER BALANCE</Text>
                      <Text style={{fontSize: 28, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>₹{dashboardMetrics.total.toLocaleString('en-IN')}</Text>
                   </View>
                   <View style={{backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : C.blueLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10}}>
                      <Text style={{color: C.bluePrimary, fontWeight: '800', fontSize: 12}}>{dashboardMetrics.count} Logs</Text>
                   </View>
                </View>
                <View style={{flexDirection: 'row', marginTop: 25, gap: 28}}>
                   <View style={{flex: 1}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}><Droplet color={isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub} size={14} style={{marginRight: 6}}/><Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontWeight: '700', fontSize: 12}}>FUEL</Text></View>
                      <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '800', fontSize: 16, marginTop: 4}}>₹{dashboardMetrics.fuel.toLocaleString('en-IN')}</Text>
                   </View>
                   <View style={{flex: 1}}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}><WrenchIcon color={isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub} size={14} style={{marginRight: 6}}/><Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontWeight: '700', fontSize: 12}}>SERVICE</Text></View>
                      <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '800', fontSize: 16, marginTop: 4}}>₹{dashboardMetrics.service.toLocaleString('en-IN')}</Text>
                   </View>
                </View>
             </View>

             {/* Dynamic Filter Engine */}
             <View style={{marginBottom: 10}}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                   {vehicles.map(v => {
                      const isSelected = filterV === v.id;
                      return (
                      <TouchableOpacity key={v.id} onPress={() => setFilterV(isSelected ? 'ALL' : v.id)} style={[styles.filterPill, {paddingVertical: 12, paddingHorizontal: 20}, {backgroundColor: isSelected ? v.color : hexToRgba(v.color, 0.1), borderColor: isSelected ? v.color : hexToRgba(v.color, 0.2)}]}>
                         <Text style={[styles.filterPillText, {fontSize: 15}, isSelected ? {color: C.white} : {color: isDarkMode ? 'rgba(255,255,255,0.6)' : v.color}]}>{v.make} {v.model}</Text>
                      </TouchableOpacity>
                   )})}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                   {['FUEL', 'SERVICE', 'TYRES'].map(cat => {
                      const isCatSel = filterC === cat;
                      return (
                      <TouchableOpacity key={cat} onPress={() => setFilterC(isCatSel ? 'ALL' : cat)} style={[styles.filterPill, {paddingVertical: 6, backgroundColor: isCatSel ? C.blueLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : C.white), borderColor: isCatSel ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.1)' : C.border)}]}>
                         <Text style={{fontWeight: '800', fontSize: 13, color: isCatSel ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub)}}>{cat}</Text>
                      </TouchableOpacity>
                   )})}
                </ScrollView>
             </View>
             
             <ScrollView contentContainerStyle={{paddingBottom: 150}} showsVerticalScrollIndicator={false}>
                 {groupedHistory.map((group, gridx) => (
                    <View key={gridx} style={{marginTop: 5}}>
                       <Text style={{fontWeight: '800', fontSize: 13, color: isDarkMode ? 'rgba(255,255,255,0.8)' : C.textSub, marginVertical: 10, letterSpacing: 0.5, textTransform: 'uppercase'}}>{group.title}</Text>
                       {group.data.map(record => (
                          <TouchableOpacity key={record.id} style={[styles.expenseCard, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : C.white, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : C.border, borderWidth: 1}]} onPress={() => { setSelectedExpense(record); setOverlay('EXPENSE_DETAIL'); }}>
                             <View style={[styles.expIconWrap, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.grayLight}]}>
                              {record.receiptUrl ? <Image source={{uri: `${GATEWAY_URL}${record.receiptUrl}`}} style={styles.expImage} /> : <ShieldCheck color={isDarkMode ? C.bluePrimary : C.blueDark} size={22} />}
                             </View>
                             <View style={styles.expMiddle}>
                                <Text style={[styles.expPrimaryText, {color: isDarkMode ? C.white : C.blueDark}]} numberOfLines={1}>{record.vehicle && record.vehicle.make} {record.vehicle && record.vehicle.model}</Text>
                                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2}}>
                                   <View style={[styles.expTag, {backgroundColor: record.amount > 5000 ? C.redLight : C.blueLight}]}>
                                      <Text style={[styles.expTagText, {color: record.amount > 5000 ? C.redPrimary : C.bluePrimary}]}>{(record.lineItems && record.lineItems.length > 0) ? (record.lineItems[0].description ? record.lineItems[0].description.toUpperCase() : 'LOG') : 'LOG'}</Text>
                                   </View>
                                </View>
                                <Text style={[styles.expSubText, {color: isDarkMode ? 'rgba(255,255,255,0.7)' : C.textSub}]} numberOfLines={1}>{record.merchant || 'Unknown'}</Text>
                             </View>
                             <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                                <Text style={[styles.expTotal, {color: isDarkMode ? C.white : C.blueDark}]}>₹{record.amount.toLocaleString('en-IN')}</Text>
                                <ChevronRight color={isDarkMode ? 'rgba(255,255,255,0.2)' : C.border} size={16} style={{marginTop: 6}} />
                             </View>
                          </TouchableOpacity>
                       ))}
                    </View>
                 ))}
                 {groupedHistory.length === 0 && <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, marginTop: 40, textAlign: 'center'}}>No matching expenses found.</Text>}
             </ScrollView>
          </View>
        )}

        {/* GARAGE ROUTING (APPLE WALLET SHOWROOM V4) */}
        {activeTab === 'GARAGE' && (
          <View style={[styles.canvas, {backgroundColor: isDarkMode ? '#000000' : C.white, paddingHorizontal: 20, paddingBottom: 0}]}>
             <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 5}}>
                <Text style={{fontSize: 34, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -1.5}}>Showroom</Text>
                <TouchableOpacity onPress={() => { setEditingVehicleId(null); setNewBrand("Kia"); setNewModel(""); setOverlay('ADD_VEHICLE'); }} style={{padding: 8}}>
                   <Plus size={32} color={isDarkMode ? C.white : C.blueDark} strokeWidth={2.5} />
                </TouchableOpacity>
             </View>
            
             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 240}}>
                {vehicles.map((v) => {
                  const asset = getVehicleAsset(v.make, v.model, isDarkMode);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      activeOpacity={0.97}
                      style={[styles.appleCardOuter, {borderRadius: 16, marginBottom: 16, backgroundColor: isDarkMode ? '#000000' : C.white, shadowColor: isDarkMode ? '#000' : C.blueDark, shadowOpacity: isDarkMode ? 0.4 : 0.08}]}
                      onPress={() => { setSelectedVehicle(v); setOverlay('GARAGE_DETAIL'); loadDeepVehicleLevel(v.id); }}
                    >
                      <View style={{borderRadius: 16, height: 188, flexDirection: 'row', overflow: 'hidden', backgroundColor: isDarkMode ? '#000000' : C.white, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'}}>
                         
                         {/* LEFT PANEL: Identity & Telemetry (Readability Boost) */}
                         <View style={{flex: 1.2, paddingLeft: 20, paddingRight: 10, justifyContent: 'center'}}>
                            {/* Compact Driver Badge */}
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                               <View style={{width: 20, height: 20, borderRadius: 10, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent', justifyContent: 'center', alignItems: 'center'}}>
                                  <User size={10} color={isDarkMode ? "#FFF" : C.blueDark} />
                               </View>
                               <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 8, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>{v.activeDriver.toUpperCase() || 'OWNER'}</Text>
                            </View>

                            <Text style={{fontSize: 24, color: isDarkMode ? '#FFFFFF' : C.blueDark, fontWeight: '900', letterSpacing: -1.0}} numberOfLines={1}>{v.make} {v.model}</Text>
                            <Text style={{fontSize: 11, color: isDarkMode ? 'rgba(255,255,255,0.3)' : C.textSub, fontWeight: '800', letterSpacing: 1.5, marginBottom: 15}}>{(v.registrationNo || 'ABC 123').toUpperCase()}</Text>

                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                               <View>
                                  <Text style={{color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginBottom: 1}}>ODOMETER</Text>
                               </View>
                               <View style={{width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)'}} />
                               <View>
                                  <Text style={{color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginBottom: 1}}>HEALTH</Text>
                                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                     {(() => {
                                        const score = v.healthScore || 100;
                                        const color = score >= 90 ? '#4ADE80' : (score >= 80 ? '#FBBF24' : '#F87171');
                                        return (
                                           <>
                                              <Activity size={9} color={color} />
                                              <Text style={{color, fontSize: 10, fontWeight: '900', marginLeft: 3}}>{score}% <Text style={{fontSize: 7, opacity: 0.6}}>{v.healthStatus || 'OPTIMAL'}</Text></Text>
                                           </>
                                        );
                                     })()}
                                  </View>
                               </View>
                            </View>
                         </View>

                         {/* RIGHT PANEL: Visual Studio (Landscape Asset) */}
                         <View style={{flex: 1, backgroundColor: isDarkMode ? '#000000' : C.white, overflow: 'hidden'}}>
                             {isDarkMode && (
                                <LinearGradient
                                  colors={[isDarkMode ? '#000000' : C.white, isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)', 'transparent']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={{position: 'absolute', width: '100%', height: '100%', zIndex: 2}}
                               />
                             )}
                            {asset.type === 'IMAGE' ? (
                               <Image 
                                 source={asset.source} 
                                 style={{width: '140%', height: '100%', marginLeft: '-20%'}} 
                                 resizeMode="contain" 
                               />
                            ) : asset.type === 'LOGO' ? (
                               <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25}}>
                                  <Image source={asset.source} style={{width: 70, height: 70}} resizeMode="contain" />
                               </View>
                            ) : (
                               <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                                  <View style={{backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}}>
                                     <Text style={{color: isDarkMode ? '#FFF' : C.blueDark, fontSize: 13, fontWeight: '900', letterSpacing: 2, textAlign: 'center'}}>{v.make.toUpperCase() || 'VEHICLE'}</Text>
                                  </View>
                                  <View style={{marginTop: 10, opacity: 0.1}}>
                                     <Car size={32} color={isDarkMode ? "#FFF" : C.blueDark} />
                                  </View>
                               </View>
                            )}
                            
                            {/* Compact Log Count Overlay */}
                            <View style={{position: 'absolute', bottom: 12, right: 12, zIndex: 3, backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}}>
                               <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, fontSize: 9, fontWeight: '800'}}>{history.filter(h => h.vehicleId === v.id).length} LOGS</Text>
                            </View>
                         </View>

                      </View>
                    </TouchableOpacity>
                  );
                })}

              {vehicles.length === 0 && (
                 <View style={{alignItems: 'center', marginTop: 100, opacity: 0.4}}>
                    <Car size={60} color={C.white} strokeWidth={1} />
                    <Text style={{color: C.white, fontSize: 17, fontWeight: '600', marginTop: 20}}>No Digital Keys Found</Text>
                 </View>
              )}
             </ScrollView>
          </View>
        )}

        {/* LOG EXPENSES ROUTING */}
        {activeTab === 'EXPENSES' && (
          <View style={[styles.canvas, {backgroundColor: isDarkMode ? '#000000' : C.bg}]}>
             <Text style={[styles.headerHero, {color: isDarkMode ? C.white : C.blueDark}]}>Log Garage Data</Text>
             <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, fontSize: 16, marginTop: 5, lineHeight: 24, paddingRight: 20}}>Keep your vehicle records pristine. Log manual visits or use AI to automatic</Text>
             
             <View style={{flexDirection: 'row', marginTop: 30, marginBottom: 30}}>
                 <TouchableOpacity style={[styles.logSquareCard, isDarkMode && {backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)'}, {marginRight: 8}]} onPress={() => { setManualForm({...manualForm, category: 'REPAIR'}); setOverlay('VEHICLE_PICKER_MANUAL'); }}>
                     <View style={[styles.logIconRound, {backgroundColor: isDarkMode ? 'rgba(248, 113, 113, 0.1)' : C.redLight}]}><WrenchIcon color={C.redPrimary} size={28} /></View>
                     <Text style={[styles.logSquareTitle, {color: isDarkMode ? C.white : C.blueDark}]}>Service</Text>
                     <Text style={[styles.logSquareSub, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>Invoices & Labor</Text>
                 </TouchableOpacity>
 
                 <TouchableOpacity style={[styles.logSquareCard, isDarkMode && {backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)'}, {marginLeft: 8}]} onPress={() => { setManualForm({...manualForm, category: 'FUEL'}); setOverlay('VEHICLE_PICKER_MANUAL'); }}>
                     <View style={[styles.logIconRound, {backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : C.blueLight}]}><Fuel color={C.bluePrimary} size={28} /></View>
                     <Text style={[styles.logSquareTitle, {color: isDarkMode ? C.white : C.blueDark}]}>Fuel Log</Text>
                     <Text style={[styles.logSquareSub, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>Fast Pump Visits</Text>
                 </TouchableOpacity>
             </View>

             <TouchableOpacity style={[styles.btnMassiveSave, {marginBottom: Platform.OS === 'ios' ? 140 : 120}]} onPress={() => {
                if (vehicles.length === 0) return Alert.alert("No Vehicles", "Please add a vehicle first.");
                setOverlay('VEHICLE_PICKER');
             }}>
               <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                 <CameraIcon color={C.white} size={22} style={{marginRight: 10}} />
                 <Text style={{color: C.white, fontWeight: '900', fontSize: 18, letterSpacing: 0.2}}>Auto Scan Vault via AI</Text>
               </View>
             </TouchableOpacity>
          </View>
        )}
        
        {/* GLOBAL FAB QUICK SCAN */}
        {(activeTab === 'DASHBOARD' || activeTab === 'EXPENSES') && (
           <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={handleQuickScan}>
              <View style={styles.fabIconRing}>
                 <CameraIcon size={24} color={C.white} strokeWidth={2.5}/>
              </View>
           </TouchableOpacity>
        )}

        {/* COMMAND CENTER OVERLAY */}
        {/* COMMAND CENTER / FLEET CONTROL (V2) */}
        <Modal visible={overlay === 'COMMAND_CENTER'} animationType="slide" presentationStyle="pageSheet" onShow={loadFleetIntelligence} onRequestClose={() => setOverlay(null)}>
            <View style={{flex: 1, backgroundColor: isDarkMode ? '#000000' : C.bg}}>
               {/* Fixed Header */}
               <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'}}>
                  <Text style={{fontSize: 22, fontWeight: '800', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>Command Center</Text>
                  <TouchableOpacity onPress={() => setOverlay(null)} style={{backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: 10, borderRadius: 18}}><X size={24} color={isDarkMode ? C.white : C.blueDark} /></TouchableOpacity>
               </View>

               <ScrollView contentContainerStyle={{padding: 24, paddingBottom: 100}}>
                  
                  {/* USER IDENTITY CARD */}
                  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 35, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : C.white, padding: 20, borderRadius: 28, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}>
                     <View style={{width: 64, height: 64, borderRadius: 24, backgroundColor: C.bluePrimary, justifyContent: 'center', alignItems: 'center', marginRight: 20}}>
                        <Text style={{color: C.white, fontSize: 24, fontWeight: '900'}}>{myUserId ? myUserId.charAt(0).toUpperCase() : 'U'}</Text>
                     </View>
                     <View style={{flex: 1}}>
                        <Text style={{color: isDarkMode ? C.white : C.blueDark, fontSize: 20, fontWeight: '800'}}>Fleetr ID</Text>
                        <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 13, fontWeight: '600'}}>{myUserId}</Text>
                     </View>
                     <TouchableOpacity onPress={() => { AsyncStorage.clear(); setMyUserId(''); setOverlay(null); }} style={{padding: 12}}>
                        <LogOut size={22} color={C.redPrimary} />
                     </TouchableOpacity>
                  </View>

                  {/* FLEET DOCUMENT VAULT (Fleet-wide) */}
                  <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15}}>MY DOCUMENT VAULT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0, marginBottom: 40}}>
                     {fleetDocuments.length === 0 ? (
                        <View style={{width: 140, aspectRatio: 0.7, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}}>
                           <FileText color={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)'} size={24} />
                           <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.5)' : C.textSub, fontSize: 9, fontWeight: '700', marginTop: 2}} numberOfLines={1}>No Docs</Text>
                        </View>
                     ) : fleetDocuments.map((doc, idx) => (
                        <TouchableOpacity key={idx} style={{marginRight: 15, width: 140, aspectRatio: 0.7, backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}} onPress={() => { setSelectedExpense({ receiptUrl: doc.fileUrl, merchant: doc.title, amount: 0, date: doc.createdAt }); setOverlay('EXPENSE_DETAIL'); }}>
                           <Image source={{uri: `${GATEWAY_URL}${doc.fileUrl}`}} style={{flex: 1}} resizeMode="cover" />
                           <View style={{position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.6)'}}>
                              <Text style={{color: isDarkMode ? C.white : C.blueDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.5}} numberOfLines={1}>{doc.type}</Text>
                              <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', marginTop: 2}} numberOfLines={1}>{doc.vehicle.make} {doc.vehicle.model}</Text>
                           </View>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>

                  {/* FLEET HEALTH ANALYTICS */}
                   {/* COMMANDS SETTINGS */}
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : C.white, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}>
                       <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Activity color={isDarkMode ? C.bluePrimary : '#4ADE80'} size={22} style={{marginRight: 15}} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: isDarkMode ? '#FFFFFF' : '#1E293B', fontWeight: '600' }}>Midnight Immersive</Text>
                            <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#64748B', fontSize: 12 }}>Optimized for OLED & low light</Text>
                          </View>
                       </View>
                       <Switch value={isDarkMode} onValueChange={setIsDarkMode} trackColor={{true: C.bluePrimary}} />
                   </View>

                   <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15}}>FLEET TELEMETRY</Text>
                  <View style={{gap: 15, marginBottom: 40}}>
                     {fleetHealth.map((vh, idx) => (
                        <View key={vh.id || idx} style={{
                          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#FFFFFF', 
                          borderRadius: 24, 
                          padding: 20, 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          borderWidth: 1, 
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E2E8F0'
                        }}>
                            <View style={{
                              width: 54, 
                              height: 54, 
                              borderRadius: 16, 
                              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F1F5F9', 
                              justifyContent: 'center', 
                              alignItems: 'center', 
                              marginRight: 16
                            }}>
                               {(() => {
                                  const asset = getVehicleAsset(vh.make, vh.model, isDarkMode);
                                  if (asset.type === 'IMAGE') return <Image source={asset.source} style={{width: 40, height: 30}} resizeMode="contain" />;
                                  if (asset.type === 'LOGO') return <Image source={asset.source} style={{width: 30, height: 30}} resizeMode="contain" />;
                                  return <Car color={isDarkMode ? '#FFFFFF' : '#1E293B'} size={24} />;
                               })()}
                            </View>
                            <View style={{flex: 1}}>
                               <Text style={{color: isDarkMode ? '#FFFFFF' : '#1E293B', fontWeight: '800', fontSize: 16}}>{vh.make} {vh.model}</Text>
                               <View style={{flexDirection: 'row', gap: 10, marginTop: 4}}>
                                  {(() => {
                                     const score = Math.round(vh.score || 100);
                                     const color = score >= 90 ? '#4ADE80' : (score >= 80 ? '#FBBF24' : '#F87171');
                                     return (
                                        <>
                                           <Text style={{color, fontSize: 11, fontWeight: '900'}}>{vh.score >= 90 ? 'OPTIMAL' : (vh.score >= 70 ? 'STABLE' : 'ACTION REQUIRED')}</Text>
                                           <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#64748B', fontSize: 11, fontWeight: '900'}}>• {score}% HEALTH</Text>
                                        </>
                                     );
                                  })()}
                               </View>
                            </View>
                            {(vh.alignDue || vh.oilDue) && <TriangleAlert color="#F87171" size={20} />}
                        </View>
                     ))}
                  </View>

                  {/* SMART MAINTENANCE LOGIC */}
                  <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15}}>SMART MAINTENANCE</Text>
                  <View style={{backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : C.white, borderRadius: 28, padding: 25, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25}}>
                         <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Droplet color={C.bluePrimary} size={20} style={{marginRight: 12}} />
                            <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '700', fontSize: 16}}>Wiper Fluid (30d)</Text>
                         </View>
                         <Switch value={reminders.wiper} onValueChange={v => setReminders({...reminders, wiper: v})} trackColor={{true: C.bluePrimary}} />
                      </View>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25}}>
                         <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Wind color={C.bluePrimary} size={20} style={{marginRight: 12}} />
                            <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '700', fontSize: 16}}>Air Pressure (15d)</Text>
                         </View>
                         <Switch value={reminders.spare} onValueChange={v => setReminders({...reminders, spare: v})} trackColor={{true: C.bluePrimary}} />
                      </View>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25}}>
                         <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Calendar color={C.bluePrimary} size={20} style={{marginRight: 12}} />
                            <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '700', fontSize: 16}}>Cabin Filter (Year)</Text>
                         </View>
                         <Switch value={reminders.cabin} onValueChange={v => setReminders({...reminders, cabin: v})} trackColor={{true: C.bluePrimary}} />
                      </View>

                       <View style={{height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 10}} />
                       <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15}}>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                             <Zap color={pushEnabled ? '#4ADE80' : 'rgba(255,255,255,0.2)'} size={20} style={{marginRight: 12}} />
                             <Text style={{color: C.white, fontWeight: '700', fontSize: 16}}>Push System Alerts</Text>
                          </View>
                          <Switch value={pushEnabled} onValueChange={v => { if(v) prepareNotifications(); else setPushEnabled(false); }} trackColor={{true: '#4ADE80'}} />
                       </View>

                      <View style={{marginTop: 10, paddingTop: 25, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)'}}>
                         <Text style={{color: 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 11, letterSpacing: 1.0, marginBottom: 12}}>BATTERY WARRANTY EXPIRY</Text>
                         <TextInput 
                           style={{backgroundColor: 'rgba(255,255,255,0.03)', color: C.white, padding: 18, borderRadius: 16, fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'}} 
                           placeholder="YYYY-MM-DD" 
                           placeholderTextColor="rgba(255,255,255,0.2)" 
                           value={batteryExp} 
                           onChangeText={setBatteryExp} 
                         />
                         {batteryExp && (new Date(batteryExp) - new Date() < 7 * 24 * 60 * 60 * 1000) && (
                            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: 'rgba(248,113,113,0.1)', padding: 12, borderRadius: 12}}>
                               <TriangleAlert color="#F87171" size={16} style={{marginRight: 8}} />
                               <Text style={{color: '#F87171', fontWeight: '800', fontSize: 12}}>CRITICAL: EXPIRES IN &lt; 7 DAYS</Text>
                            </View>
                         )}
                      </View>
                  </View>

                  <TouchableOpacity style={{marginTop: 40, alignItems: 'center'}} onPress={() => setOverlay(null)}>
                     <Text style={{color: 'rgba(255,255,255,0.3)', fontWeight: '800', letterSpacing: 1.5, fontSize: 10}}>VERSION 4.2.0 • ENCRYPTED SESSION</Text>
                  </TouchableOpacity>

               </ScrollView>
            </View>
        </Modal>

        {/* AUTH MODAL */}
        <Modal visible={overlay === 'AUTH'} animationType="fade">
           <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#000' : C.bg}}>
              <Text style={{fontSize: 32, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, marginBottom: 40}}>Welcome Back</Text>
              <TouchableOpacity style={{backgroundColor: C.bluePrimary, padding: 20, borderRadius: 20}} onPress={() => setOverlay(null)}>
                 <Text style={{color: C.white, fontWeight: '800', fontSize: 16}}>Sign In to Continue</Text>
              </TouchableOpacity>
           </View>
        </Modal>

        {/* BOTTOM TAB BAR */}
        <View style={styles.tabContainer}>
           <View style={[styles.tabInner, {backgroundColor: isDarkMode ? '#000000' : 'rgba(255,255,255,0.98)', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}>
            <TouchableOpacity style={styles.tabItem} onPress={() => switchTab('DASHBOARD')}>
              <Home size={22} color={activeTab === 'DASHBOARD' ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8')} strokeWidth={activeTab === 'DASHBOARD' ? 2.5 : 2} />
              <Text style={[styles.tabLabel, activeTab === 'DASHBOARD' && styles.tabLabelActive, {color: activeTab === 'DASHBOARD' ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8')}]}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => switchTab('GARAGE')}>
              <Car size={22} color={activeTab === 'GARAGE' ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8')} strokeWidth={activeTab === 'GARAGE' ? 2.5 : 2} />
              <Text style={[styles.tabLabel, activeTab === 'GARAGE' && styles.tabLabelActive, {color: activeTab === 'GARAGE' ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8')}]}>Garage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => switchTab('EXPENSES')}>
              <DollarSign size={22} color={activeTab === 'EXPENSES' ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8')} strokeWidth={activeTab === 'EXPENSES' ? 2.5 : 2} />
              <Text style={[styles.tabLabel, activeTab === 'EXPENSES' && styles.tabLabelActive, {color: activeTab === 'EXPENSES' ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8')}]}>Log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- OVERLAYS --- */}

        {/* GARAGE DETAIL & TELEMETRY (APPLE VAULT V4) */}
        <Modal visible={overlay === 'GARAGE_DETAIL'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOverlay(null)}>
            <View style={{flex: 1, backgroundColor: isDarkMode ? '#000000' : C.bg}}>
              {/* Header */}
              <View style={[styles.modalHeader, {paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}]}>
                <TouchableOpacity onPress={() => setOverlay(null)} style={{padding: 8}}><X size={28} color={isDarkMode ? C.white : C.blueDark} /></TouchableOpacity>
                <Text style={{fontSize: 22, fontWeight: '800', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>Vehicle Vault</Text>
                <View style={{flexDirection: 'row'}}>
                   <TouchableOpacity onPress={handleEditInit} style={{padding: 8, marginRight: 8}}><Edit2 size={22} color={isDarkMode ? C.white : C.blueDark} /></TouchableOpacity>
                   <TouchableOpacity onPress={handleDeleteConfirm} style={{padding: 8}}><Trash2 size={22} color={isDarkMode ? C.redPrimary : C.redPrimary} /></TouchableOpacity>
                </View>
              </View>

              {selectedVehicle && (
              <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 100}}>
                   
                   {/* HERO CARD (SPLIT SHOWROOM ALIGNMENT) */}
                   <View style={{borderRadius: 20, height: 160, flexDirection: 'row', overflow: 'hidden', backgroundColor: isDarkMode ? '#000' : C.white, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', marginBottom: 25, shadowColor: isDarkMode ? '#000' : C.blueDark, shadowOpacity: isDarkMode ? 0.3 : 0.05, shadowRadius: 10, elevation: 5}}>
                         
                         {/* LEFT PANEL */}
                         <View style={{flex: 1.2, paddingLeft: 20, paddingRight: 10, justifyContent: 'center'}}>
                            <Text style={{fontSize: 24, color: isDarkMode ? '#FFFFFF' : C.blueDark, fontWeight: '900', letterSpacing: -1.0}} numberOfLines={1}>{selectedVehicle.make} {selectedVehicle.model}</Text>
                            <Text style={{fontSize: 12, color: isDarkMode ? 'rgba(255,255,255,0.3)' : C.textSub, fontWeight: '800', letterSpacing: 1.5, marginBottom: 15}}>{(selectedVehicle.registrationNo || 'ABC 123').toUpperCase()}</Text>

                            <View style={{flexDirection: 'row', gap: 10}}>
                               <View style={{backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent'}}>
                                  <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, fontWeight: '800', fontSize: 9}}>{selectedVehicle.accessRole.toUpperCase()}</Text>
                               </View>
                               <View style={{backgroundColor: 'rgba(74,222,128,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)'}}>
                                  <Text style={{color: '#4ADE80', fontWeight: '800', fontSize: 9}}>ENCRYPTED</Text>
                               </View>
                            </View>
                         </View>

                         {/* RIGHT PANEL: Studio Blend */}
                         <View style={{flex: 1, backgroundColor: isDarkMode ? '#000' : C.white, overflow: 'hidden'}}>
                             {isDarkMode && (
                                 <LinearGradient
                                   colors={[isDarkMode ? '#000000' : C.white, 'transparent', 'transparent']}
                                   start={{ x: 0, y: 0 }}
                                   end={{ x: 1, y: 0 }}
                                   style={{position: 'absolute', width: '100%', height: '100%', zIndex: 2}}
                                />
                             )}
                            {(() => {
                               const asset = getVehicleAsset(selectedVehicle.make, selectedVehicle.model, isDarkMode);
                               if (asset.type === 'IMAGE') {
                                  return <Image source={asset.source} style={{width: '140%', height: '100%', marginLeft: '-20%'}} resizeMode="contain" />;
                               } else if (asset.type === 'LOGO') {
                                  return <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25}}><Image source={asset.source} style={{width: 60, height: 60, opacity: isDarkMode ? 0.3 : 0.6}} resizeMode="contain" /></View>;
                               }
                               return <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.05}}><Car size={60} color={isDarkMode ? "#FFF" : C.blueDark} /></View>;
                            })()}
                         </View>
                   </View>

                   {/* GROUPED STATS SLABS */}
                   <View style={{flexDirection: 'row', marginBottom: 30}}>
                      <View style={{flex: 1, backgroundColor: isDarkMode ? '#2C2C2E' : C.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', shadowColor: C.blueDark, shadowOpacity: isDarkMode ? 0 : 0.02, elevation: 1}}>
                         <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.3)' : C.textSub, fontSize: 10, fontWeight: '900', letterSpacing: 1.0, marginBottom: 8}}>ODOMETER</Text>
                         <Text style={{color: isDarkMode ? C.white : C.blueDark, fontSize: 18, fontWeight: '800'}}>{(selectedVehicle.odometer || 0).toLocaleString()} <Text style={{fontSize: 12, color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'}}>km</Text></Text>
                      </View>
                      <View style={{flex: 1, backgroundColor: isDarkMode ? '#2C2C2E' : C.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', shadowColor: C.blueDark, shadowOpacity: isDarkMode ? 0 : 0.02, elevation: 1}}>
                         <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.3)' : C.textSub, fontSize: 10, fontWeight: '900', letterSpacing: 1.0, marginBottom: 8}}>HEALTH</Text>
                          {(() => { const score = selectedVehicle.healthScore || 100; const color = score >= 90 ? "#4ADE80" : (score >= 80 ? "#FBBF24" : "#F87171"); return <View style={{flexDirection: "row", alignItems: "flex-end"}}><Text style={{color, fontSize: 18, fontWeight: "800"}}>{score}%</Text><Text style={{color, fontSize: 8, fontWeight: "900", marginLeft: 6, marginBottom: 3}}>{selectedVehicle.healthStatus || "OPTIMAL"}</Text></View>; })()}
                      </View>
                   </View>

                   {/* DOCUMENT VAULT SECTION */}
                   <Text style={{color: isDarkMode ? C.white : C.blueDark, fontSize: 18, fontWeight: '800', marginBottom: 15, paddingHorizontal: 4}}>Document Vault</Text>
                   <View style={{flexDirection: 'row', marginBottom: 35}}>
                      {deepVehicleData && deepVehicleData.documents && ['RC', 'INSURANCE', 'PUC'].map((type) => {
                         const doc = deepVehicleData.documents.find(d => d.type === type);
                         return (
                           <TouchableOpacity 
                             key={type} 
                             style={{flex: 1, aspectRatio: 0.8, backgroundColor: isDarkMode ? '#2C2C2E' : C.white, borderRadius: 16, padding: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: doc ? 'rgba(74,222,128,0.2)' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}}
                             onPress={() => {
                               if (doc) {
                                  setSelectedExpense({ receiptUrl: doc.fileUrl, amount: 0, merchant: doc.title, date: doc.createdAt, vehicle: selectedVehicle });
                                  setOverlay('EXPENSE_DETAIL');
                               } else {
                                  setCameraMode('DOC');
                                  setTargetDocType(type);
                                  setOverlay('CAMERA');
                               }
                             }}
                            >
                              {doc ? <FileText color="#4ADE80" size={32} /> : <CameraIcon color={isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"} size={32} />}
                              <Text style={{color: doc ? (isDarkMode ? C.white : C.blueDark) : (isDarkMode ? 'rgba(255,255,255,0.3)' : C.textSub), fontSize: 11, fontWeight: '800', marginTop: 12, letterSpacing: 0.5}}>{type}</Text>
                              {doc && <View style={{position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80'}} />}
                           </TouchableOpacity>
                         );
                      })}
                   </View>

                   {/* NETWORK COLLABORATION */}
                   <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4}}>NETWORK COLLABORATION</Text>
                   <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 35, backgroundColor: isDarkMode ? '#2C2C2E' : C.grayLight, padding: 16, borderRadius: 20}}>
                      <TextInput 
                        style={{flex: 1, color: isDarkMode ? C.white : C.blueDark, fontSize: 16, fontWeight: '600'}} 
                        placeholder="Invite User ID" 
                        placeholderTextColor={isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)"} 
                        value={collaboratorId} 
                        onChangeText={setCollaboratorId} 
                        autoCapitalize="none" 
                      />
                      <TouchableOpacity style={{backgroundColor: C.bluePrimary, width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center'}} onPress={shareVehicle} disabled={loading}>
                          {loading ? <ActivityIndicator color={C.white} size="small" /> : <ArrowRight color={C.white} size={20} />}
                      </TouchableOpacity>
                   </View>

                   {/* EXPENSE LEDGER IN VAULT */}
                   <Text style={{color: isDarkMode ? C.white : C.blueDark, fontSize: 18, fontWeight: '800', marginBottom: 15, paddingHorizontal: 4}}>Expense Ledger</Text>
                   {deepVehicleData && deepVehicleData.expenses && deepVehicleData.expenses.map(record => (
                     <TouchableOpacity key={record.id} style={{backgroundColor: isDarkMode ? '#2C2C2E' : C.white, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)', shadowColor: C.blueDark, shadowOpacity: isDarkMode ? 0 : 0.05, shadowRadius: 10, elevation: 2}} onPress={() => { setSelectedExpense(record); setOverlay('EXPENSE_DETAIL'); }}>
                        <View style={{backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.grayLight, width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center'}}>
                          <Text style={{color: isDarkMode ? C.white : C.blueDark, fontSize: 20, fontWeight: "900"}}>₹</Text>
                        </View>
                        <View style={{flex: 1, marginLeft: 16}}>
                           <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '800', fontSize: 15}}>{new Date(record.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</Text>
                           <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 12, fontWeight: '600', marginTop: 2}}>{record.merchant || 'Unknown'}</Text>
                        </View>
                        <Text style={{color: isDarkMode ? C.white : C.blueDark, fontWeight: '800', fontSize: 16}}>₹{record.amount.toLocaleString()}</Text>
                     </TouchableOpacity>
                   ))}
                   {(!deepVehicleData || !deepVehicleData.expenses || deepVehicleData.expenses.length === 0) && (
                      <View style={{alignItems: 'center', paddingVertical: 40, opacity: 0.3}}>
                         <Activity size={32} color={isDarkMode ? C.white : C.blueDark} />
                         <Text style={{color: isDarkMode ? C.white : C.blueDark, marginTop: 15, fontWeight: '600'}}>No logs recorded</Text>
                      </View>
                   )}
              </ScrollView>
              )}
            </View>
        </Modal>

        {/* EXPENSE DETAIL DEEP DIVE */}
        <Modal visible={overlay === 'EXPENSE_DETAIL'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOverlay(null)}>
            {selectedExpense && (
              <View style={{flex: 1, backgroundColor: isDarkMode ? '#000000' : C.bg}}>
                <View style={[styles.modalHeader, {paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}]}>
                  <TouchableOpacity onPress={() => setOverlay(null)} style={{padding: 5}}><X size={26} color={isDarkMode ? C.white : C.blueDark} /></TouchableOpacity>
                  <Text style={{fontSize: 20, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>Vault Explorer</Text>
                  <View style={{width: 36}}/>
                </View>
                <ScrollView contentContainerStyle={{padding: 24}}>
                   <View style={{alignItems: 'center', marginBottom: 35}}>
                      <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontWeight: '700', fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10}}>{selectedExpense.vehicle.make || 'Vehicle Record'}</Text>
                      <Text style={{fontSize: 48, fontWeight: '900', letterSpacing: -1.5, color: isDarkMode ? C.white : C.blueDark}}>₹{selectedExpense.amount.toLocaleString('en-IN')}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
                         <MapPin size={14} color={isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub} style={{marginRight: 6}} />
                         <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, fontSize: 15, fontWeight: '600'}}>{selectedExpense.merchant || 'Unknown Location'}</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                         <Calendar size={14} color={isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub} style={{marginRight: 6}} />
                         <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, fontSize: 15, fontWeight: '600'}}>{new Date(selectedExpense.date).toLocaleDateString()}</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                         <Activity size={14} color={C.bluePrimary} style={{marginRight: 6}} />
                         <Text style={{color: C.bluePrimary, fontSize: 15, fontWeight: '800'}}>MILAGE LOGGED: {selectedExpense.odometer ? `${selectedExpense.odometer} km` : 'N/A'}</Text>
                      </View>
                   </View>

                   {selectedExpense.receiptUrl && (
                      <View style={{marginBottom: 35}}>
                         <Text style={[styles.inputLabel, {marginTop: 0, marginBottom: 12}]}>SCANNED PHYSICAL RECEIPT</Text>
                         <View style={{height: 400, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border}}>
                             <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent style={{flex: 1}}>
                                <Image source={{uri: `${GATEWAY_URL}${selectedExpense.receiptUrl}`}} style={{width: Dimensions.get('window').width - 48, height: 400}} resizeMode="contain" />
                             </ScrollView>
                         </View>
                      </View>
                   )}

                   <Text style={[styles.inputLabel, {marginTop: 0, marginBottom: 12, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>LINE ITEMS & IMPACT</Text>
                   <View style={{backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : C.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.border}}>
                       {selectedExpense.lineItems ? (Array.isArray(selectedExpense.lineItems) ? selectedExpense.lineItems : JSON.parse(selectedExpense.lineItems)).map((li, idx) => (
                           <View key={idx} style={{flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8}}>
                              <Text style={{flex: 1, color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, fontSize: 15, fontWeight: '500'}}>{li.description} {li.quantity ? `(Vol: ${li.quantity})` : ''}</Text>
                              <Text style={{fontWeight: '800', color: isDarkMode ? C.white : C.blueDark, fontSize: 15}}>₹{li.total.toLocaleString('en-IN')}</Text>
                           </View>
                        )) : <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.3)' : C.textSub}}>No line items recorded.</Text>}
                   </View>
                </ScrollView>
              </View>
            )}
        </Modal>

        {/* ADD VEHICLE MODAL */}
        <Modal visible={overlay === 'ADD_VEHICLE'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOverlay(null)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, backgroundColor: isDarkMode ? '#000000' : C.bg}}>
              <View style={[styles.modalHeader, {paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}]}>
                <TouchableOpacity onPress={() => { setOverlay(null); setEditingVehicleId(null); }} style={{padding: 5}}><X size={26} color={isDarkMode ? C.white : C.blueDark} /></TouchableOpacity>
                <Text style={{fontSize: 20, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>{editingVehicleId ? "Edit Vehicle" : "New Vehicle"}</Text>
                <TouchableOpacity onPress={handleCreateVehicle} disabled={loading} style={{padding: 5}}>
                   {loading ? <ActivityIndicator size="small" color={C.bluePrimary}/> : <Check size={26} color={C.bluePrimary} />}
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{padding: 24}}>
                  <Text style={styles.inputLabel}>MAKE (MANUFACTURER)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                      {["Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Kia", "Toyota", "Honda", "MG", "Volkswagen", "Skoda", "Other"].map(brand => (
                         <TouchableOpacity key={brand} onPress={() => { setNewBrand(brand === "Other" ? "" : brand); setNewModel(""); }} style={{paddingHorizontal: 20, paddingVertical: 12, backgroundColor: newBrand === brand ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.05)' : C.white), borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : C.border}}>
                             <Text style={{fontWeight: '800', color: newBrand === brand ? C.white : (isDarkMode ? C.white : C.blueDark)}}>{brand}</Text>
                         </TouchableOpacity>
                      ))}
                  </ScrollView>
                  <TextInput style={[styles.inputField, {marginBottom: 0, color: isDarkMode ? C.white : C.blueDark}]} placeholder="Enter Make manually..." placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.2)' : C.textSub} value={newBrand} onChangeText={setNewBrand} />

                  <Text style={styles.inputLabel}>VEHICLE MODEL</Text>
                  {(() => {
                      const modelMap = {
                        "Maruti Suzuki": ["Swift", "Dzire", "Baleno", "Brezza", "Ertiga", "Fronx", "Grand Vitara", "WagonR"],
                        "Hyundai": ["Creta", "Venue", "i20", "Verna", "Aura", "Tucson", "Exter", "Alcazar"],
                        "Tata": ["Nexon", "Harrier", "Punch", "Safari", "Altroz", "Tiago", "Tigor", "Curvv"],
                        "Mahindra": ["Thar", "XUV700", "Scorpio-N", "Bolero", "XUV300", "XUV400"],
                        "Kia": ["Seltos", "Sonet", "Carens", "EV6"],
                        "Toyota": ["Fortuner", "Innova", "Hyryder", "Glanza", "Camry"],
                        "Honda": ["City", "Amaze", "Elevate"],
                        "MG": ["Hector", "Astor", "Comet", "Gloster"],
                        "Volkswagen": ["Virtus", "Taigun", "Tiguan"],
                        "Skoda": ["Slavia", "Kushaq", "Kodiaq"]
                      };
                      const models = modelMap[newBrand] || [];
                      if (models.length > 0) {
                          return (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                                {models.map(mdl => (
                                   <TouchableOpacity key={mdl} onPress={() => setNewModel(mdl)} style={{paddingHorizontal: 20, paddingVertical: 12, backgroundColor: newModel === mdl ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.05)' : C.white), borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : C.border}}>
                                       <Text style={{fontWeight: '800', color: newModel === mdl ? C.white : (isDarkMode ? C.white : C.textSub)}}>{mdl}</Text>
                                   </TouchableOpacity>
                                ))}
                            </ScrollView>
                          );
                      }
                      return null;
                  })()}
                  <TextInput style={[styles.inputField, {color: isDarkMode ? C.white : C.blueDark}]} placeholder="Enter Model / Variant manually..." placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.2)' : C.textSub} value={newModel} onChangeText={setNewModel} />

                  <Text style={styles.inputLabel}>REGISTRATION NUMBER</Text>
                  <TextInput style={[styles.inputField, {color: isDarkMode ? C.white : C.blueDark}]} placeholder="MH-12-XX-1234" placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.2)' : C.textSub} value={newVin} onChangeText={setNewVin} autoCapitalize="characters" />

                  <Text style={styles.inputLabel}>CURRENT ODOMETER (KM)</Text>
                  <TextInput style={[styles.inputField, {color: isDarkMode ? C.white : C.blueDark}]} placeholder="12500" placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.2)' : C.textSub} keyboardType="numeric" value={newOdo} onChangeText={setNewOdo} />

                  <Text style={styles.inputLabel}>IDENTIFIER COLOR</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
                      {['#0B1120', '#DC2626', '#2563EB', '#16A34A', '#8B5CF6'].map(col => (
                         <TouchableOpacity key={col} onPress={() => setNewColor(col)} style={{width: 48, height: 48, borderRadius: 24, backgroundColor: col, borderWidth: newColor === col ? 4 : 0, borderColor: C.border}} />
                      ))}
                  </View>
              </ScrollView>
            </KeyboardAvoidingView>
        </Modal>

        {/* VEHICLE PICKERS FOR LOGGING */}
        <Modal visible={overlay === 'VEHICLE_PICKER'} animationType="fade" transparent={true} onRequestClose={() => setOverlay(null)}>
           <View style={{flex: 1, backgroundColor: 'rgba(11, 17, 32, 0.7)', justifyContent: 'flex-end'}}>
             <View style={[styles.sheetContainer, {backgroundColor: isDarkMode ? '#1C1C1E' : C.white}]}>
                <Text style={[styles.sheetTitle, {color: isDarkMode ? C.white : C.blueDark}]}>Select Target Vehicle</Text>
                {vehicles.map((v) => (
                  <TouchableOpacity key={v.id} style={[styles.sheetCard, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : C.grayLight}]} onPress={() => { setActiveVehicleId(v.id); setOverlay('CAMERA'); }}>
                     <View style={[styles.sheetIconWrap, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.white}]}><CarFront color={isDarkMode ? C.white : C.blueDark} size={22} /></View>
                     <View style={{flex: 1, marginLeft: 15}}>
                        <Text style={{fontWeight: '800', fontSize: 17, color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.2}}>{v.make} {v.model}</Text>
                        <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub, fontSize: 13, fontWeight: '600', marginTop: 2}}>{v.registrationNo}</Text>
                     </View>
                     <ChevronRight color={isDarkMode ? 'rgba(255,255,255,0.2)' : C.border} size={24} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.btnActionSecondary, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.grayLight}]} onPress={() => setOverlay(null)}><Text style={{fontWeight: '800', fontSize: 16, color: isDarkMode ? C.white : C.blueDark}}>Cancel Scan</Text></TouchableOpacity>
             </View>
           </View>
        </Modal>

        <Modal visible={overlay === 'VEHICLE_PICKER_MANUAL'} animationType="fade" transparent={true} onRequestClose={() => setOverlay(null)}>
           <View style={{flex: 1, backgroundColor: 'rgba(11, 17, 32, 0.7)', justifyContent: 'flex-end'}}>
             <View style={[styles.sheetContainer, {backgroundColor: isDarkMode ? '#1C1C1E' : C.white}]}>
                <Text style={[styles.sheetTitle, {color: isDarkMode ? C.white : C.blueDark}]}>Assign Manual Log</Text>
                {vehicles.map((v) => (
                  <TouchableOpacity key={v.id} style={[styles.sheetCard, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : C.grayLight}]} onPress={() => { setActiveVehicleId(v.id); setOverlay('MANUAL_ENTRY'); }}>
                     <View style={[styles.sheetIconWrap, {backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.white}]}><CarFront color={isDarkMode ? C.white : C.blueDark} size={22} /></View>
                     <View style={{flex: 1, marginLeft: 15}}>
                        <Text style={{fontWeight: '800', fontSize: 17, color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.2}}>{v.make} {v.model}</Text>
                     </View>
                     <ChevronRight color={isDarkMode ? 'rgba(255,255,255,0.2)' : C.border} size={24} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.btnActionSecondary, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.05)'}]} onPress={() => setOverlay(null)}><Text style={{fontWeight: '800', fontSize: 16, color: isDarkMode ? C.white : C.blueDark}}>Cancel Log</Text></TouchableOpacity>
             </View>
           </View>
        </Modal>

        {/* MANUAL ENTRY MODAL */}
        <Modal visible={overlay === 'MANUAL_ENTRY'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOverlay(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, backgroundColor: isDarkMode ? '#000' : C.bg}}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => {setOverlay(null); setManualPhoto(null); setSelectedServices([]);}} style={{padding: 5}}><X size={26} color={isDarkMode ? C.white : C.blueDark} /></TouchableOpacity>
                <Text style={{fontSize: 20, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>{manualForm.category} LOG</Text>
                <TouchableOpacity onPress={submitManualLog} disabled={loading} style={{padding: 5}}>
                   {loading ? <ActivityIndicator size="small" color={C.bluePrimary}/> : <Text style={{fontWeight: '900', color: C.white, backgroundColor: C.blueDark, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12}}>Save</Text>}
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{padding: 24}}>
                 {manualForm.category === 'REPAIR' ? (
                    <View>
                        <Text style={[styles.inputLabel, {marginTop: 0, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>SERVICE DATE</Text>
                        <TextInput style={[styles.inputField, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} value={manualForm.date} onChangeText={(v)=>setManualForm({...manualForm, date: v})} />
                        
                        <Text style={[styles.inputLabel, {marginTop: 22, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>SERVICE TYPE</Text>
                        <View style={{flexDirection: 'row', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.grayLight, borderRadius: 16, padding: 4, marginBottom: 25}}>
                            <TouchableOpacity style={{flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: repairTab === 'REGULAR' ? C.blueDark : 'transparent', borderRadius: 12}} onPress={() => setRepairTab('REGULAR')}>
                                <Text style={{fontWeight: '800', fontSize: 13, color: repairTab === 'REGULAR' ? C.white : (isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub)}}>Regular Service</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: repairTab === 'MISC' ? (isDarkMode ? '#333' : C.white) : 'transparent', borderRadius: 12}} onPress={() => setRepairTab('MISC')}>
                                <Text style={{fontWeight: '800', fontSize: 13, color: repairTab === 'MISC' ? (isDarkMode ? C.white : C.blueDark) : (isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub)}}>Miscellaneous</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>WHAT WAS SERVICED?</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 25}}>
                           {SERVICE_GRID[repairTab].map(srv => {
                              const isSelected = selectedServices.includes(srv.id);
                              const IconComp = srv.icon;
                              return (
                                 <TouchableOpacity key={srv.id} onPress={() => toggleService(srv.id)} style={{width: '31%', backgroundColor: isSelected ? C.blueLight : (isDarkMode ? 'rgba(255,255,255,0.03)' : C.white), borderWidth: 1, borderColor: isSelected ? C.blueDark : (isDarkMode ? 'rgba(255,255,255,0.1)' : C.border), borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12, position: 'relative'}}>
                                    {isSelected && <View style={{position: 'absolute', top: -5, right: -5, backgroundColor: C.blueDark, borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center'}}><Check color={C.white} size={14} strokeWidth={3} /></View>}
                                    <IconComp color={isSelected ? C.bluePrimary : (isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub)} size={28} style={{marginBottom: 10}} strokeWidth={1.5}/>
                                    <Text style={{fontWeight: '800', fontSize: 11, textAlign: 'center', color: isSelected ? C.blueDark : (isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub)}}>{srv.id}</Text>
                                 </TouchableOpacity>
                              )
                           })}
                        </View>

                        <Text style={[styles.inputLabel, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>SERVICE COST (₹) optional</Text>
                        <TextInput style={[styles.inputField, {fontSize: 22, fontWeight: '900'}, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} placeholder="₹ 0" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" value={manualForm.amount} onChangeText={(v)=>setManualForm({...manualForm, amount: v})} />

                        <Text style={[styles.inputLabel, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>NOTES (optional)</Text>
                        <TextInput style={[styles.inputField, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} placeholder="e.g. Full synthetic 5W-30, replaced brake pads" placeholderTextColor="rgba(255,255,255,0.2)" value={manualForm.merchant} onChangeText={(v)=>setManualForm({...manualForm, merchant: v})} multiline />
                    </View>
                 ) : (
                    <View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                           <View style={{flex: 1, marginRight: 10}}>
                              <Text style={[styles.inputLabel, {marginTop: 0, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>AMOUNT (₹)</Text>
                              <TextInput style={[styles.inputField, {fontSize: 24, fontWeight: '900'}, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} placeholder="0" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" value={manualForm.amount} onChangeText={(v)=>setManualForm({...manualForm, amount: v})} />
                           </View>
                           <View style={{flex: 1, marginLeft: 10}}>
                              <Text style={[styles.inputLabel, {marginTop: 0, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>DATE</Text>
                              <TextInput style={[styles.inputField, {fontSize: 18}, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} value={manualForm.date} onChangeText={(v)=>setManualForm({...manualForm, date: v})} />
                           </View>
                        </View>

                        <Text style={[styles.inputLabel, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>VENDOR NAME</Text>
                        <TextInput style={[styles.inputField, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} placeholder="e.g. Shell Petrol Pump" placeholderTextColor="rgba(255,255,255,0.2)" value={manualForm.merchant} onChangeText={(v)=>setManualForm({...manualForm, merchant: v})} />

                        <Text style={[styles.inputLabel, {color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>CURRENT ODOMETER (KM) (OPTIONAL)</Text>
                        <TextInput style={[styles.inputField, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} placeholder="12550" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" value={manualForm.odometer} onChangeText={(v)=>setManualForm({...manualForm, odometer: v})} />

                        <Text style={[styles.inputLabel, {marginTop: 35, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>ATTACH PHYSICAL RECEIPT</Text>
                        {manualPhoto ? (
                           <Image source={{uri: `data:image/jpeg;base64,${manualPhoto}`}} style={{width: '100%', height: 200, borderRadius: 20, marginTop: 10}} />
                        ) : (
                           <TouchableOpacity style={[styles.btnActionSecondary, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.05)'}, {paddingVertical: 25, flexDirection: 'row', justifyContent: 'center', marginTop: 10}]} onPress={()=>setOverlay('MANUAL_CAMERA')}>
                              <CameraIcon size={22} color={isDarkMode ? '#FFF' : C.blueDark} strokeWidth={2.5} style={{marginRight: 10}}/>
                              <Text style={{fontWeight: '800', color: isDarkMode ? '#FFF' : C.blueDark, fontSize: 16}}>Open Camera Validation</Text>
                           </TouchableOpacity>
                        )}
                    </View>
                 )}
              </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* REUSABLE CAMERA */}
        <Modal visible={overlay === 'CAMERA' || overlay === 'MANUAL_CAMERA'} animationType="slide">
           <View style={{flex: 1, backgroundColor: '#000'}}>
             <CameraView style={{flex: 1}} facing="back" ref={cameraRef} />
             <View style={styles.cameraOverlay}>
                <TouchableOpacity onPress={() => setOverlay(null)} style={{padding: 20}}>
                    <Text style={{color: '#fff', fontSize: 18, fontWeight:'700'}}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureButtonOuter} onPress={takePicture}>
                   <View style={styles.captureButtonInner} />
                </TouchableOpacity>
                <View style={{width: 80}} />
             </View>
           </View>
        </Modal>

        {/* SCAN RESULT AI INTERFACE */}
        <Modal visible={overlay === 'SCAN_RESULT'} animationType="slide">
           <SafeAreaView style={{flex: 1, backgroundColor: isDarkMode ? '#000000' : C.bg}}>
             <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
             {loading ? (
                 <View style={{flex:1, justifyContent: 'center', alignItems: 'center'}}>
                    <View style={{width: 80, height: 80, backgroundColor: C.white, borderRadius: 40, justifyContent: 'center', alignItems: 'center', shadowColor: C.bluePrimary, shadowOpacity: 0.3, shadowRadius: 20, marginBottom: 30}}>
                        <ActivityIndicator size="large" color={C.bluePrimary} />
                    </View>
                    <Text style={{fontSize: 22, fontWeight: '900', color: C.blueDark, letterSpacing: -0.5}}>MotoKeeper Brain</Text>
                    <Text style={{fontSize: 16, color: C.textSub, fontWeight: '600', marginTop: 8}}>Isolating layout topologies...</Text>
                 </View>
             ) : parsedData ? (
                 <ScrollView style={{padding: 24}} keyboardShouldPersistTaps="handled">
                    <Text style={[styles.headerHero, {fontSize: 32, alignSelf: 'center', marginVertical: 20, color: C.green}]}>Success ✓</Text>
                    <View style={[styles.parsedCard, {backgroundColor: isDarkMode ? '#1C1C1E' : C.white, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : C.border, borderWidth: 1}]}>
                       <Text style={{fontSize: 24, fontWeight: '900', color: isDarkMode ? C.white : C.blueDark, letterSpacing: -0.5}}>{parsedData.merchant}</Text>
                       <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.6)' : C.textSub, marginBottom: 25, fontWeight: '600', marginTop: 4}}>{parsedData.date}</Text>
                       
                       {parsedData.line_items.map((li, idx) => (
                          <View key={idx} style={{flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8}}>
                             <Text style={{flex: 1, color: isDarkMode ? 'rgba(255,255,255,0.8)' : C.textSub, fontSize: 16, fontWeight: '500'}}>{li.description} {li.quantity ? `(Vol: ${li.quantity})` : ''}</Text>
                             <Text style={{fontWeight: '800', color: isDarkMode ? C.white : C.blueDark, fontSize: 16}}>₹{li.total.toLocaleString('en-IN')}</Text>
                          </View>
                       ))}
                       <View style={{height: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : C.border, marginVertical: 25}} />
                       <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                          <Text style={{fontWeight: '800', fontSize: 16, color: isDarkMode ? 'rgba(255,255,255,0.7)' : C.textSub, marginBottom: 4}}>TOTAL</Text>
                          <Text style={{fontWeight: '900', fontSize: 36, color: C.bluePrimary, letterSpacing: -1.5}}>₹{parsedData.total_amount.toLocaleString('en-IN')}</Text>
                       </View>
                    </View>
                    
                    <Text style={[styles.inputLabel, {marginTop: 35, color: isDarkMode ? 'rgba(255,255,255,0.4)' : C.textSub}]}>LINK ODOMETER READING (OPTIONAL)</Text>
                    <TextInput style={[styles.inputField, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#FFF'}]} placeholder="Milage shown on car dash" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" value={scanOdo} onChangeText={setScanOdo} />

                    <TouchableOpacity style={[styles.btnMassiveSave, {marginTop: 30, marginBottom: 40}]} onPress={finalizeScan}>
                       <Text style={{color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 0.5}}>Append to Ledger</Text>
                    </TouchableOpacity>
                 </ScrollView>
             ) : (
                 <View style={{flex: 1, padding: 0, backgroundColor: '#000'}}>
                    <Image style={{width: '100%', height: '70%', resizeMode: 'cover'}} source={{uri: `data:image/jpeg;base64,${photoBase64}`}} />
                    <View style={{padding: 30, justifyContent: 'space-between', flexDirection: 'row'}}>
                       <TouchableOpacity style={[styles.btnActionSecondary, {flex: 1, marginRight: 10}, isDarkMode && {backgroundColor: 'rgba(255,255,255,0.05)'}]} onPress={() => setOverlay('CAMERA')}><Text style={{fontWeight: '800', fontSize: 16, color: isDarkMode ? C.white : C.blueDark}}>Retake</Text></TouchableOpacity>
                       <TouchableOpacity style={[styles.btnActionPrimary, {flex: 1.5, marginLeft: 10}]} onPress={uploadAndScan}><Text style={{color: '#FFF', fontWeight: '800', fontSize: 16}}>Analyze Impact</Text></TouchableOpacity>
                    </View>
                 </View>
             )}
             </KeyboardAvoidingView>
           </SafeAreaView>
        </Modal>

      </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MotoKeeperApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  canvas: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  headerHero: { fontSize: 28, fontWeight: '900', color: C.blueDark, marginBottom: 15, marginTop: 0, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.blueDark, letterSpacing: -0.2 },
  
  metricsCard: { backgroundColor: C.white, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: C.blueDark, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: C.border },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.white, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: C.border },
  filterPillActive: { backgroundColor: C.blueDark, borderColor: C.blueDark },
  filterPillText: { fontWeight: '800', fontSize: 13, color: C.textSub },
  filterPillTextActive: { color: C.white },

  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, shadowColor: C.blueDark, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  
  expenseCard: { padding: 14, borderRadius: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  expIconWrap: { backgroundColor: C.grayLight, width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  expImage: { width: 44, height: 44, borderRadius: 12 },
  expMiddle: { flex: 1, marginLeft: 14, paddingRight: 10 },
  expPrimaryText: { fontWeight: '800', fontSize: 15, color: C.blueDark, letterSpacing: -0.2 },
  expTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  expTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  expSubText: { color: C.textSub, fontSize: 12, fontWeight: '600' },
  expTotal: { fontWeight: '800', fontSize: 16, color: C.blueDark, letterSpacing: 0 },

  vehicleCard: { padding: 20, borderRadius: 20, marginBottom: 16, shadowColor: C.blueDark, shadowOffset: {width:0, height: 8}, shadowOpacity: 0.1, shadowRadius: 15, elevation: 6 },
  vIconRing: { backgroundColor: 'rgba(255,255,255,0.15)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  vCardName: { fontWeight: '900', fontSize: 18, letterSpacing: -0.5, color: C.white },
  roleBadge: { color: C.white, fontSize: 10, fontWeight: '900', letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 6, opacity: 0.8 },
  logsPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },

  logSquareCard: { flex: 1, aspectRatio: 1, backgroundColor: C.white, borderRadius: 16, padding: 18, justifyContent: 'flex-end', borderWidth: 1, borderColor: C.border },
  logIconRound: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 18, left: 18 },
  logSquareTitle: { fontWeight: '800', fontSize: 16, color: C.blueDark, marginBottom: 4, letterSpacing: -0.2 },
  logSquareSub: { color: C.textSub, fontSize: 12, fontWeight: '500' },

  btnMassiveSave: { backgroundColor: C.blueDark, width: '100%', paddingVertical: 18, borderRadius: 14, alignItems: 'center', shadowColor: C.blueDark, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  btnActionPrimary: { backgroundColor: C.bluePrimary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnActionSecondary: { backgroundColor: C.grayLight, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnAdd: { backgroundColor: C.bluePrimary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  inputLabel: { fontSize: 11, fontWeight: '900', color: C.textSub, marginTop: 22, marginBottom: 8, letterSpacing: 1.0 },
  inputField: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, padding: 16, borderRadius: 14, fontSize: 16, color: C.blueDark, fontWeight: '600' },

  sheetContainer: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 25, paddingBottom: 50, shadowColor: C.blueDark, shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: C.blueDark, marginBottom: 25, letterSpacing: -0.5, textAlign: 'center' },
  sheetCard: { backgroundColor: C.grayLight, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sheetIconWrap: { backgroundColor: C.white, width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  parsedCard: { backgroundColor: C.white, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border, shadowColor: C.blueDark, shadowOffset: {width:0, height: 8}, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },

  fab: { position: 'absolute', bottom: Platform.OS === 'ios' ? 110 : 90, right: 24, shadowColor: C.bluePrimary, shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.25, shadowRadius: 15, elevation: 10 },
  fabIconRing: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.bluePrimary, justifyContent: 'center', alignItems: 'center' },

  tabContainer: { position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 35 : 20, backgroundColor: 'transparent' },
  tabInner: { backgroundColor: 'rgba(255,255,255,0.98)', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, borderRadius: 24, shadowColor: C.blueDark, shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.05, shadowRadius: 20, elevation: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  tabItem: { alignItems: 'center', flex: 1 },
  tabLabel: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '800' },
  tabLabelActive: { color: C.bluePrimary, fontWeight: '900' },

  cameraOverlay: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 40, backgroundColor: 'rgba(0,0,0,0.6)' },
  captureButtonOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  luxuryVehicleCard: { backgroundColor: C.luxuryCard, borderRadius: 24, marginBottom: 20, padding: 22, borderWidth: 1, borderColor: C.luxuryBorder, shadowColor: C.bluePrimary, shadowOffset: {width:0, height: 10}, shadowOpacity: 0.1, shadowRadius: 18, elevation: 15 },
  luxuryCardTitle: { fontWeight: '900', fontSize: 24, color: C.white, letterSpacing: -0.5 },
  luxuryCardPlate: { color: C.silver, fontWeight: '800', fontSize: 13, marginTop: 4, letterSpacing: 1.5 },
  luxuryIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  luxuryLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  luxuryValue: { color: C.white, fontSize: 18, fontWeight: '900' },
  luxuryStatusPill: { backgroundColor: 'rgba(74,222,128,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' },
  
  showroomFab: { position: 'absolute', bottom: 110, alignSelf: 'center', shadowColor: C.bluePrimary, shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.3, shadowRadius: 18, elevation: 15 },
  showroomFabInner: { backgroundColor: C.bluePrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  // APPLE WALLET GARAGE STYLES
  appleCardOuter: { marginBottom: 14, borderRadius: 20, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.3, shadowRadius: 15, elevation: 12 },
  appleCardInner: { minHeight: 190, padding: 20 },
  appleCardName: { fontWeight: '900', letterSpacing: -0.8, marginBottom: 2, fontSize: 26 },
  appleCardPlate: { letterSpacing: 1.2, fontWeight: '800', fontSize: 15 },
  appleCardImage: { width: '100%', height: '100%' }
});
