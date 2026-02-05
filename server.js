require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini with environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Middleware
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// Explicitly serve index.html for root path to fix Vercel deployment
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Enhanced Multer configuration (ONLY ONE DEFINITION)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use /tmp for serverless environments (Vercel), otherwise use local uploads folder
        const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
        const uploadsDir = isServerless ? '/tmp' : path.join(process.cwd(), 'uploads');

        // Ensure uploads directory exists (only needed for local, /tmp always exists)
        if (!isServerless && !fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Create safe filename
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept more file types
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'text/plain'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, images, and text files are allowed.`), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// Database simulation (use real database in production)
let patients = [];
let prescriptions = [];
let bills = [];

// Enhanced Patient Management API Routes with Name
app.post('/api/patients', (req, res) => {
    try {
        const { name, gender, clinicalNotes, currentMeds } = req.body;

        // Validate required fields
        if (!name || !gender || !clinicalNotes) {
            return res.status(400).json({
                success: false,
                error: 'Name, gender and clinical notes are required'
            });
        }

        const patient = {
            id: 'patient_' + Date.now().toString(),
            name: name,
            gender: gender,
            clinicalNotes: clinicalNotes,
            currentMeds: currentMeds || '',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        patients.push(patient);

        console.log('Patient saved successfully:', patient.name, patient.id);

        res.json({
            success: true,
            patient: patient,
            message: 'Patient information saved successfully'
        });

    } catch (error) {
        console.error('Save patient error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save patient information'
        });
    }
});

// Get all patients
app.get('/api/patients', (req, res) => {
    res.json({
        success: true,
        patients: patients,
        count: patients.length
    });
});

// Get specific patient
app.get('/api/patients/:id', (req, res) => {
    const patientId = req.params.id;
    const patient = patients.find(p => p.id === patientId);

    if (patient) {
        res.json({ success: true, patient: patient });
    } else {
        res.status(404).json({ success: false, error: 'Patient not found' });
    }
});

// Robust AI-powered ICD-10 code suggestion
async function suggestICD10Codes(clinicalNotes) {
    try {
        const prompt = `
        You are a medical coding expert. Analyze these clinical notes and suggest the most appropriate ICD-10 codes.
        
        CLINICAL NOTES: "${clinicalNotes}"
        
        Return ONLY a JSON array of ICD-10 codes with descriptions in this exact format:
        ["J06.9 - Acute upper respiratory infection", "R05 - Cough"]
        
        Rules:
        1. Return ONLY the JSON array, no other text
        2. Use official ICD-10 codes
        3. Include both code and description
        4. Maximum 5 most relevant codes
        5. Focus on the primary condition first

        Suggested codes:`;

        const result = await model.generateContent(prompt);
        let response = result.response.text();

        // Clean the response to ensure it's valid JSON
        response = response.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('AI Response:', response);

        const codes = JSON.parse(response);
        return codes;

    } catch (error) {
        console.error('ICD-10 Suggestion Error:', error);
        console.log('Using fallback ICD-10 codes');
        return getFallbackICD10Codes(clinicalNotes);
    }
}

// Enhanced fallback ICD-10 codes
function getFallbackICD10Codes(clinicalNotes) {
    const lowerNotes = clinicalNotes.toLowerCase();
    const codes = [];

    // Respiratory conditions
    if (lowerNotes.includes('respiratory infection') || lowerNotes.includes('uri') || lowerNotes.includes('cold')) {
        codes.push("J06.9 - Acute upper respiratory infection, unspecified");
    }
    if (lowerNotes.includes('cough')) {
        codes.push("R05 - Cough");
    }
    if (lowerNotes.includes('fever')) {
        codes.push("R50.9 - Fever, unspecified");
    }
    if (lowerNotes.includes('sore throat') || lowerNotes.includes('pharyngitis')) {
        codes.push("J02.9 - Acute pharyngitis, unspecified");
    }

    // Hypertension
    if (lowerNotes.includes('hypertension') || lowerNotes.includes('high blood pressure')) {
        codes.push("I10 - Essential (primary) hypertension");
    }

    // Diabetes
    if (lowerNotes.includes('diabetes')) {
        codes.push("E11.9 - Type 2 diabetes mellitus without complications");
    }

    // Headache
    if (lowerNotes.includes('headache')) {
        codes.push("R51 - Headache");
    }

    // Pain conditions
    if (lowerNotes.includes('back pain')) {
        codes.push("M54.9 - Dorsalgia, unspecified");
    }
    if (lowerNotes.includes('chest pain')) {
        codes.push("R07.9 - Chest pain, unspecified");
    }
    if (lowerNotes.includes('abdominal pain')) {
        codes.push("R10.9 - Abdominal pain, unspecified");
    }

    // Default if no specific conditions found
    if (codes.length === 0) {
        if (lowerNotes.includes('infection')) {
            codes.push("B99.9 - Infectious disease, unspecified");
        } else {
            codes.push("R69 - Illness, unspecified");
        }
    }

    return codes;
}

// Simple medication suggester (more reliable)
// Simple medication suggester (more reliable)
async function suggestMedications(clinicalNotes) {
    try {
        const prompt = `
        Based on these clinical notes: "${clinicalNotes}"
        
        Suggest 2-4 appropriate medications in this JSON format:
        [
            {"name": "Medication Name 500mg", "cost": 25.00, "purpose": "Fever reduction"},
            {"name": "Another Medication 10mg", "cost": 15.50, "purpose": "Pain relief"}
        ]
        
        Return ONLY the JSON array. Do not wrap in markdown or code blocks.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('Medication Response:', cleanResponse);

        return JSON.parse(cleanResponse);

    } catch (error) {
        console.error('Medication Suggestion Error:', error);
        return getFallbackMedications(clinicalNotes);
    }
}

// Enhanced AI analysis function to include name
// Enhanced AI analysis function to include name
// Enhanced AI analysis function with Multimodal support
async function analyzeWithAI(patientData, prescriptionText, uploadedFileInfo, filePath, mimeType) {
    try {
        const parts = [];

        // Add text prompt
        parts.push({
            text: `
            You are a medical AI assistant. Analyze the following patient information and the attached medical document (prescription/report):

            PATIENT INFORMATION:
            - Name: ${patientData.name}
            - Gender: ${patientData.gender}
            - Clinical Notes: ${patientData.clinicalNotes}
            - Current Medications: ${patientData.currentMeds}
            
            Please analyze the attached document and provide:
            1. Medication suggestions/verification
            2. Potential drug interactions
            3. Treatment recommendations
            4. ICD-10 coding suggestions

            Format your response as structured medical advice.
            `
        });

        // Add image/PDF data if available
        if (filePath && mimeType) {
            try {
                // Read file as base64
                const fileData = fs.readFileSync(filePath);
                const base64Data = fileData.toString('base64');

                parts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                });
            } catch (readError) {
                console.error("Error reading file for AI:", readError);
                parts.push({ text: `[Error reading attached file: ${readError.message}]` });
            }
        }

        const result = await model.generateContent(parts);
        return result.response.text();
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return "AI analysis is currently unavailable. Please try again later.";
    }
}

// Enhanced API endpoint with better error handling
app.post('/api/auto-suggest-codes', async (req, res) => {
    try {
        const { clinicalNotes } = req.body;

        if (!clinicalNotes || clinicalNotes.trim().length < 5) {
            return res.status(400).json({
                success: false,
                error: 'Clinical notes are required and should be at least 5 characters long'
            });
        }

        console.log('Requesting ICD-10 codes for:', clinicalNotes);

        const suggestedCodes = await suggestICD10Codes(clinicalNotes);

        console.log('Suggested codes:', suggestedCodes);

        res.json({
            success: true,
            suggestedCodes: suggestedCodes,
            count: suggestedCodes.length
        });

    } catch (error) {
        console.error('Auto-suggest codes endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to suggest ICD-10 codes',
            fallback: getFallbackICD10Codes(req.body.clinicalNotes || '')
        });
    }
});

app.post('/api/auto-suggest-medications', async (req, res) => {
    try {
        const { clinicalNotes, currentMeds } = req.body;

        if (!clinicalNotes) {
            return res.status(400).json({ success: false, error: 'Clinical notes are required' });
        }

        const suggestedMeds = await suggestMedications(clinicalNotes, currentMeds);

        res.json({
            success: true,
            suggestedMedications: suggestedMeds
        });
    } catch (error) {
        console.error('Auto-suggest medications error:', error);
        res.status(500).json({ success: false, error: 'Failed to suggest medications' });
    }
});

app.post('/api/auto-complete-billing', async (req, res) => {
    try {
        const { clinicalNotes, currentMeds } = req.body;

        if (!clinicalNotes) {
            return res.status(400).json({ success: false, error: 'Clinical notes are required' });
        }

        const [suggestedCodes, suggestedMeds] = await Promise.all([
            suggestICD10Codes(clinicalNotes),
            suggestMedications(clinicalNotes, currentMeds)
        ]);

        res.json({
            success: true,
            suggestedCodes: suggestedCodes,
            suggestedMedications: suggestedMeds,
            message: 'Billing information automatically generated by AI'
        });
    } catch (error) {
        console.error('Auto-complete billing error:', error);
        res.status(500).json({ success: false, error: 'Failed to auto-complete billing' });
    }
});

// Test endpoint to check AI connectivity
app.get('/api/test-ai', async (req, res) => {
    try {
        const testNotes = "Patient with acute upper respiratory infection, fever, and persistent cough";
        const codes = await suggestICD10Codes(testNotes);

        res.json({
            success: true,
            message: 'AI is working correctly (Gemini)',
            testInput: testNotes,
            generatedCodes: codes,
            aiStatus: 'Connected'
        });
    } catch (error) {
        res.json({
            success: false,
            message: 'AI connection issue',
            error: error.message,
            aiStatus: 'Disconnected'
        });
    }
});

// AI Consult Chat Endpoint
app.post('/api/ai-consult', async (req, res) => {
    try {
        const { message, patientData, icd10Codes } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const prompt = `
        You are a medical AI assistant participating in a doctor-patient consultation simulation.
        
        CONTEXT:
        Patient: ${patientData ? patientData.name : 'Unknown'} (${patientData ? patientData.gender : 'Unknown'})
        Clinical Usage: ${patientData ? patientData.clinicalNotes : 'None'}
        Diagnosis/ICD-10: ${icd10Codes ? icd10Codes.join(', ') : 'None'}
        
        USER QUESTION: "${message}"
        
        Provide a helpful, professional, and medically conservative response.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.json({
            success: true,
            response: responseText
        });
    } catch (error) {
        console.error('AI Consult Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get AI response'
        });
    }
});

// Enhanced upload endpoint with better error handling
app.post('/api/upload-prescription', upload.single('prescription'), async (req, res) => {
    try {
        console.log('Upload request received');

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded or file type not supported'
            });
        }

        const { patientId, clinicalNotes, currentMeds } = req.body;

        console.log('File uploaded:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Simulate prescription text extraction
        const prescriptionText = `Uploaded document: ${req.file.originalname} (${req.file.mimetype})`;

        const patientData = {
            name: patientId || 'Unknown Patient',
            gender: 'Unknown',
            clinicalNotes: clinicalNotes || 'No clinical notes provided',
            currentMeds: currentMeds || 'No current medications'
        };

        // Analyze with AI
        let aiAnalysis = "AI analysis is currently unavailable.";
        try {
            // Pass file path and mimetype for real AI analysis
            aiAnalysis = await analyzeWithAI(
                patientData,
                prescriptionText,
                req.file.filename,
                req.file.path,
                req.file.mimetype
            );
        } catch (aiError) {
            console.error('AI analysis failed:', aiError);
            aiAnalysis = "AI analysis skipped due to technical issues.";
        }

        // Store prescription record
        const prescription = {
            id: Date.now().toString(),
            patientId: patientId || 'unknown',
            filePath: req.file.path,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            aiAnalysis,
            uploadDate: new Date().toISOString()
        };
        prescriptions.push(prescription);

        res.json({
            success: true,
            message: 'File uploaded and analyzed successfully',
            analysis: aiAnalysis,
            fileInfo: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                uploadPath: `/uploads/${req.file.filename}`
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Upload failed: ' + error.message
        });
    }
});

// Fixed PDF Bill Generation Function
function generatePDFBill(patientData, medications, icd10Codes, aiSuggestions, totalAmount) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const filename = `bill-${Date.now()}.pdf`;

            // Use /tmp for serverless environments (Vercel)
            const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
            const billsDir = isServerless ? '/tmp' : path.join(process.cwd(), 'bills');
            const filepath = path.join(billsDir, filename);

            // Ensure bills directory exists (only needed for local)
            if (!isServerless && !fs.existsSync(billsDir)) {
                fs.mkdirSync(billsDir, { recursive: true });
            }

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // Header
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#007bff')
                .text('MEDICAL BILLING STATEMENT', { align: 'center' });
            doc.moveDown(0.5);

            doc.fontSize(10).font('Helvetica').fillColor('black')
                .text(`Date: ${new Date().toLocaleDateString()}`, { continued: true })
                .text(`   Bill ID: B${Date.now()}`, { align: 'right' });
            doc.moveDown(1);

            // Patient Information
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#333')
                .text('PATIENT INFORMATION');
            doc.moveDown(0.5);

            doc.fontSize(10).font('Helvetica')
                .text(`Name: ${patientData.name || 'Not provided'}`, { indent: 20 })
                .text(`Gender: ${patientData.gender || 'Not provided'}`, { indent: 20 })
                .text(`Clinical Notes: ${patientData.clinicalNotes || 'Not provided'}`, { indent: 20 })
                .text(`Current Medications: ${patientData.currentMeds || 'None'}`, { indent: 20 });
            doc.moveDown(1);

            // Medications and Charges
            doc.fontSize(14).font('Helvetica-Bold')
                .text('MEDICATIONS & CHARGES');
            doc.moveDown(0.5);

            if (medications && medications.length > 0) {
                medications.forEach((med, index) => {
                    doc.fontSize(10).font('Helvetica')
                        .text(`${index + 1}. ${med.name || 'Unnamed medication'} - $${(med.cost || 0).toFixed(2)}`, { indent: 20 });
                });
            } else {
                doc.fontSize(10).font('Helvetica')
                    .text('No medications listed', { indent: 20 });
            }
            doc.moveDown(0.5);

            // Consultation Fee
            doc.fontSize(10).font('Helvetica')
                .text(`Consultation Fee: $75.00`, { indent: 20 });

            // ICD-10 Coding Fee
            if (icd10Codes && icd10Codes.length > 0) {
                const codingFee = icd10Codes.length * 15.00;
                doc.text(`Medical Coding (${icd10Codes.length} codes): $${codingFee.toFixed(2)}`, { indent: 20 });
            }
            doc.moveDown(1);

            // ICD-10 Codes
            doc.fontSize(14).font('Helvetica-Bold')
                .text('ICD-10 CODES');
            doc.moveDown(0.5);

            if (icd10Codes && icd10Codes.length > 0) {
                icd10Codes.forEach((code, index) => {
                    doc.fontSize(10).font('Helvetica')
                        .text(`${index + 1}. ${code}`, { indent: 20 });
                });
            } else {
                doc.fontSize(10).font('Helvetica')
                    .text('No ICD-10 codes provided', { indent: 20 });
            }
            doc.moveDown(1);

            // AI Recommendations
            doc.fontSize(14).font('Helvetica-Bold')
                .text('AI RECOMMENDATIONS');
            doc.moveDown(0.5);

            if (aiSuggestions && aiSuggestions.length > 0) {
                // Split AI suggestions into manageable chunks
                const maxWidth = 500;
                const suggestions = aiSuggestions.split('\n');

                suggestions.forEach(line => {
                    if (line.trim().length > 0) {
                        doc.fontSize(8).font('Helvetica')
                            .text(line.trim(), {
                                indent: 20,
                                width: maxWidth,
                                align: 'left'
                            });
                    }
                });
            } else {
                doc.fontSize(10).font('Helvetica')
                    .text('No AI recommendations provided', { indent: 20 });
            }
            doc.moveDown(1);

            // Total Amount
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#d9534f')
                .text(`TOTAL AMOUNT: $${(totalAmount || 0).toFixed(2)}`, { align: 'right' });
            doc.moveDown(2);

            // Footer
            doc.fontSize(8).font('Helvetica').fillColor('gray')
                .text('This is an AI-generated medical bill. Please verify all information with healthcare professionals.', { align: 'center' })
                .text('Generated by Medical AI Assistant System', { align: 'center' });

            doc.end();

            stream.on('finish', () => {
                console.log('PDF generated successfully:', filename);
                resolve(filename);
            });

            stream.on('error', (error) => {
                console.error('Stream error:', error);
                reject(error);
            });

        } catch (error) {
            console.error('PDF generation error:', error);
            reject(error);
        }
    });
}

// Enhanced Bill Generation Endpoint
app.post('/api/generate-bill', async (req, res) => {
    try {
        console.log('Received bill generation request:', req.body);

        const { patientData, medications, icd10Codes, aiSuggestions, totalAmount } = req.body;

        // Validate required fields
        if (!patientData) {
            return res.status(400).json({
                success: false,
                error: 'Patient data is required'
            });
        }

        if (!medications || medications.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one medication is required'
            });
        }

        // Validate medication costs
        const invalidMeds = medications.filter(med => !med.cost || med.cost <= 0);
        if (invalidMeds.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Medications missing costs: ${invalidMeds.map(med => med.name).join(', ')}`
            });
        }

        const filename = await generatePDFBill(
            patientData,
            medications,
            icd10Codes || [],
            aiSuggestions || 'No AI recommendations provided.',
            totalAmount || 0
        );

        // Store bill record
        const bill = {
            id: Date.now().toString(),
            patientId: patientData.id,
            filename,
            totalAmount: totalAmount || 0,
            generatedAt: new Date().toISOString()
        };
        bills.push(bill);

        console.log('Bill generated successfully:', filename);

        res.json({
            success: true,
            message: 'Bill generated successfully',
            downloadUrl: `/bills/${filename}`,
            billId: bill.id
        });

    } catch (error) {
        console.error('Bill generation endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate bill: ' + error.message
        });
    }
});

// Serve static files dynamically to support Vercel /tmp
app.get('/uploads/:filename', (req, res) => {
    const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const directory = isServerless ? '/tmp' : path.join(process.cwd(), 'uploads');
    const filepath = path.join(directory, req.params.filename);

    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).send('File not found');
    }
});

app.get('/bills/:filename', (req, res) => {
    const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const directory = isServerless ? '/tmp' : path.join(process.cwd(), 'bills');
    const filepath = path.join(directory, req.params.filename);

    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).send('Bill not found');
    }
});

// Test upload endpoint with Environment Diagnostics
app.get('/api/test-upload', (req, res) => {
    const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
    // Use explicit /tmp for Vercel, resolved path for local
    const uploadsDir = isServerless ? '/tmp' : path.join(process.cwd(), 'uploads');
    const billsDir = isServerless ? '/tmp' : path.join(process.cwd(), 'bills');

    // Check writability (try to write a small test file)
    let writeStatus = 'Unknown';
    try {
        const testFile = path.join(uploadsDir, 'write-test.txt');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        writeStatus = 'Writable';
    } catch (e) {
        writeStatus = `Failed: ${e.message}`;
    }

    res.json({
        success: true,
        environment: isServerless ? 'Serverless/Vercel' : 'Local/Standard',
        apiKey: process.env.GEMINI_API_KEY ? 'Present' : 'MISSING (Check Vercel Env Vars)',
        directories: {
            uploads: fs.existsSync(uploadsDir) ? 'Exists' : 'Created/Missing',
            bills: fs.existsSync(billsDir) ? 'Exists' : 'Created/Missing',
            path: uploadsDir,
            writeCheck: writeStatus
        }
    });
});

// Fallback medications when AI is unavailable
function getFallbackMedications(clinicalNotes) {
    const lowerNotes = clinicalNotes.toLowerCase();
    const medications = [];

    if (lowerNotes.includes('respiratory') || lowerNotes.includes('cough') || lowerNotes.includes('cold')) {
        medications.push({
            name: "Acetaminophen 500mg",
            cost: 15.00,
            frequency: "Every 6 hours as needed",
            purpose: "Fever and pain relief"
        });
        medications.push({
            name: "Dextromethorphan 15mg",
            cost: 12.50,
            frequency: "Every 4-6 hours",
            purpose: "Cough suppression"
        });
        medications.push({
            name: "Guaifenesin 400mg",
            cost: 18.00,
            frequency: "Every 4 hours",
            purpose: "Mucus clearance"
        });
    }
    if (lowerNotes.includes('hypertension')) {
        medications.push({
            name: "Lisinopril 10mg",
            cost: 22.00,
            frequency: "Once daily",
            purpose: "Blood pressure control"
        });
    }
    if (lowerNotes.includes('infection') && lowerNotes.includes('bacterial')) {
        medications.push({
            name: "Amoxicillin 500mg",
            cost: 35.00,
            frequency: "Three times daily for 7 days",
            purpose: "Antibiotic for bacterial infection"
        });
    }

    return medications;
}

// Only start server if run directly (not via Vercel/serverless)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Medical Assistant Server running at http://localhost:${port}`);
        // Create necessary directories
        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
        if (!fs.existsSync('bills')) fs.mkdirSync('bills', { recursive: true });
        console.log('Uploads directory:', fs.existsSync('uploads') ? 'Created' : 'Failed');
        console.log('Bills directory:', fs.existsSync('bills') ? 'Created' : 'Failed');
    });
}

// Export for Vercel
module.exports = app;