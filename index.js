const express = require('express'); 
const mongoose = require('mongoose'); 

const app = express(); 
app.use(express.json()); 

// 🚀 VERCEL SERVERLESS DB CONNECTION LOGIC
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return; // Agar pehle se connected hai toh wapas connect mat karo
  try {
    const MONGO_URI = process.env.MONGO_URI; 
    if (!MONGO_URI) throw new Error("MONGO_URI environment variable is missing!");
    
    const db = await mongoose.connect(MONGO_URI);
    isConnected = db.connections[0].readyState === 1;
    console.log("MongoDB Connected Successfully for Serverless!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
};

// License Schema 
const LicenseSchema = new mongoose.Schema({ 
  labId: { type: String, required: true, unique: true }, 
  labName: String, 
  expiryDate: String, 
  working: { type: Boolean, default: true } 
}); 
const License = mongoose.models.License || mongoose.model('License', LicenseSchema); 

// Browser check ke liye route
app.get('/', (req, res) => {
  res.send("🚀 LIMS Licensing Server is RUNNING Successfully!");
});

// ----------------------------------------------------
// 🛡️ ADMIN DASHBOARD ROUTE (Website UI)
// ----------------------------------------------------
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LIMS Admin Dashboard</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 flex items-center justify-center min-h-screen font-sans">
      <div class="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 class="text-3xl font-black text-blue-700 mb-2 text-center">Admin Control</h2>
        <p class="text-gray-500 mb-6 text-sm text-center">Manage Customer Licenses</p>
        
        <form id="licenseForm" class="flex flex-col gap-4">
          <div>
            <label class="text-sm font-bold text-gray-700">Lab ID</label>
            <input type="text" id="labId" placeholder="e.g. LAB_001" required class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 uppercase font-bold mt-1">
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700">Lab Name</label>
            <input type="text" id="labName" placeholder="e.g. City Path Lab" required class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 mt-1">
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700">Expiry Date</label>
            <input type="date" id="expiryDate" required class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 mt-1">
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700">App Status</label>
            <select id="working" class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 mt-1 font-bold">
              <option value="true" class="text-green-600">🟢 Active (App Chalegi)</option>
              <option value="false" class="text-red-600">🔴 Blocked (App Band Hogi)</option>
            </select>
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700">Admin Secret Password</label>
            <input type="password" id="adminSecret" placeholder="Enter Secret Key" required class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 mt-1">
          </div>

          <button type="submit" class="bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md mt-2">
            Save License
          </button>
        </form>

        <div id="message" class="mt-4 text-center font-bold text-sm hidden"></div>
      </div>

      <script>
        document.getElementById('licenseForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const msgBox = document.getElementById('message');
          msgBox.className = "mt-4 text-center font-bold text-sm text-blue-600";
          msgBox.innerText = "Saving to Cloud...";
          msgBox.style.display = "block";

          const payload = {
            labId: document.getElementById('labId').value.toUpperCase(),
            labName: document.getElementById('labName').value,
            expiryDate: document.getElementById('expiryDate').value,
            working: document.getElementById('working').value === 'true',
            adminSecret: document.getElementById('adminSecret').value
          };

          try {
            const response = await fetch('/api/admin/upsert-license', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await response.json();

            if(response.ok) {
              msgBox.className = "mt-4 text-center font-bold text-sm text-green-600";
              msgBox.innerText = "✅ License Saved Successfully!";
            } else {
              msgBox.className = "mt-4 text-center font-bold text-sm text-red-600";
              msgBox.innerText = "❌ Error: " + (data.message || data.error || "Failed");
            }
          } catch(err) {
            msgBox.className = "mt-4 text-center font-bold text-sm text-red-600";
            msgBox.innerText = "❌ Network Error!";
          }
        });
      </script>
    </body>
    </html>
  `);
});

// 1. API: Check License Status (Electron app isko call karegi) 
app.post('/api/check-license', async (req, res) => { 
  try { 
    await connectDB(); // Puraane code ki jagah yahan connection ensure hoga
    const { labId } = req.body; 
    if (!labId) return res.status(400).json({ error: 'Lab ID is required' }); 
    
    let license = await License.findOne({ labId }); 
    if (!license) { 
      return res.json({ working: false, message: 'Lab not registered on cloud' }); 
    } 
    
    const today = new Date().toISOString().split('T')[0]; 
    if (today > license.expiryDate) { 
      license.working = false; 
      await license.save(); 
    } 
    res.json({ working: license.working, expiryDate: license.expiryDate, labName: license.labName }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  } 
}); 

// 2. API: Admin Dashboard se Lab Add karne ya Expiry Extend karne ke liye 
app.post('/api/admin/upsert-license', async (req, res) => { 
  try { 
    await connectDB(); // Yahan bhi database connection ensure hoga
    const { labId, labName, expiryDate, working, adminSecret } = req.body; 
    
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') { 
      return res.status(401).json({ error: 'Unauthorized' }); 
    } 
    
    const updated = await License.findOneAndUpdate( 
      { labId }, { labName, expiryDate, working }, { upsert: true, new: true } 
    ); 
    res.json({ success: true, updated }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  } 
}); 

module.exports = app;

const PORT = process.env.PORT || 3000; 
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}