let currentPatient = null;
let icd10Codes = [];
let medications = [];
let currentAnalysis = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeUploadArea();
    loadSampleData();
});

function initializeUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

function loadSampleData() {
    // Add sample ICD-10 code
    icd10Codes.push('J06.9');
    updateCodeList();
    
    // Add sample medication
    medications.push({ name: 'Acetaminophen 500mg', cost: 15.00 });
    updateBillingSummary();
}

// Fixed Save Patient Function with Name
async function savePatient() {
    const name = document.getElementById('patientName').value.trim();
    const gender = document.getElementById('patientGender').value;
    const clinicalNotes = document.getElementById('clinicalNotes').value.trim();
    const currentMeds = document.getElementById('currentMeds').value.trim();

    // Validate required fields
    if (!name) {
        showMessage('❌ Please enter patient name before saving.', 'error');
        document.getElementById('patientName').focus();
        return;
    }

    if (!clinicalNotes) {
        showMessage('❌ Please enter clinical notes before saving.', 'error');
        document.getElementById('clinicalNotes').focus();
        return;
    }

    if (clinicalNotes.length < 5) {
        showMessage('❌ Clinical notes should be at least 5 characters long.', 'error');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '💾 Saving...';
    button.disabled = true;

    const patientData = {
        name: name,
        gender: gender,
        clinicalNotes: clinicalNotes,
        currentMeds: currentMeds
    };

    console.log('Saving patient:', patientData);

    try {
        const response = await fetch('/api/patients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(patientData)
        });

        const result = await response.json();
        
        if (result.success) {
            currentPatient = result.patient;
            
            showMessage(`✅ Patient "${name}" saved successfully!`, 'success');
            addToChat(`AI Assistant: Patient "${name}" information saved. I'm ready to analyze prescriptions and provide recommendations.`);
            
            // Update patient status display
            updatePatientInfoDisplay();
            
            // Enable AI features now that patient is saved
            enableAIFeatures();
            
        } else {
            throw new Error(result.error || 'Failed to save patient');
        }
        
    } catch (error) {
        console.error('Save patient error:', error);
        showMessage('❌ Error saving patient information: ' + error.message, 'error');
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Update patient info display
function updatePatientInfoDisplay() {
    if (currentPatient) {
        const patientStatus = document.getElementById('patientStatus');
        const currentPatientName = document.getElementById('currentPatientName');
        const currentPatientGender = document.getElementById('currentPatientGender');
        const patientSaveTime = document.getElementById('patientSaveTime');
        
        currentPatientName.textContent = currentPatient.name;
        currentPatientGender.textContent = currentPatient.gender;
        patientSaveTime.textContent = new Date().toLocaleTimeString();
        
        patientStatus.style.display = 'block';
    }
}

// Enable AI features after patient is saved
function enableAIFeatures() {
    // Enable all AI buttons
    const aiButtons = document.querySelectorAll('.btn-ai, .btn-ai-primary');
    aiButtons.forEach(button => {
        button.disabled = false;
        button.style.opacity = '1';
    });
    
    // Enable file upload
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.style.opacity = '1';
    uploadArea.style.pointerEvents = 'auto';
}

// Disable AI features when no patient is saved
function disableAIFeatures() {
    const aiButtons = document.querySelectorAll('.btn-ai, .btn-ai-primary');
    aiButtons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.6';
    });
    
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.style.opacity = '0.6';
    uploadArea.style.pointerEvents = 'none';
}

// Initialize - disable AI features until patient is saved
document.addEventListener('DOMContentLoaded', function() {
    initializeUploadArea();
    loadSampleData();
    disableAIFeatures(); // Start with AI features disabled
});

// Update auto-suggest functions to require patient name
async function autoSuggestCodes() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    const clinicalNotes = document.getElementById('clinicalNotes').value.trim();
    
    if (!clinicalNotes) {
        showMessage('❌ Please enter clinical notes first.', 'warning');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '🔄 AI Analyzing...';
    button.disabled = true;

    showMessage(`AI is analyzing clinical notes for ${currentPatient.name}...`, 'info');
    
    try {
        const response = await fetch('/api/auto-suggest-codes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clinicalNotes })
        });

        const result = await response.json();
        
        if (result.success) {
            // Clear existing codes
            icd10Codes = [];
            
            // Add suggested codes automatically
            result.suggestedCodes.forEach(code => {
                const codePart = code.split(/[ -]/)[0].trim();
                if (codePart && !icd10Codes.includes(codePart)) {
                    icd10Codes.push(codePart);
                }
            });
            
            updateCodeList();
            showMessage(`✅ AI added ${icd10Codes.length} ICD-10 codes for ${currentPatient.name}!`, 'success');
            addToChat(`AI Assistant: I've analyzed ${currentPatient.name}'s clinical notes and automatically added ${icd10Codes.length} relevant ICD-10 codes.`);
            
        } else {
            throw new Error(result.error || 'Failed to generate codes');
        }
        
    } catch (error) {
        console.error('Auto-suggest codes error:', error);
        showMessage('❌ Error generating ICD-10 codes. Using fallback codes.', 'error');
        
        // Use fallback codes
        const fallbackCodes = getFallbackCodesFromNotes(clinicalNotes);
        icd10Codes = fallbackCodes;
        updateCodeList();
        addToChat(`AI Assistant: I've added fallback ICD-10 codes for ${currentPatient.name} based on clinical notes.`);
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Update other AI functions similarly to check for currentPatient
async function autoSuggestMedications() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }
    // ... rest of the function remains the same but use currentPatient.name in messages
}

async function autoCompleteAllBilling() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }
    // ... rest of the function remains the same but use currentPatient.name in messages
}
// Enhanced file upload handling
function initializeUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
        uploadArea.innerHTML = '<div class="upload-content"><span class="upload-icon">⬆️</span><p>Drop file here to upload</p></div>';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
        updateUploadAreaContent();
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
        updateUploadAreaContent();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    updateUploadAreaContent();
}

function updateUploadAreaContent() {
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.innerHTML = `
        <div class="upload-content">
            <span class="upload-icon">📄</span>
            <p>Drag & drop prescription or discharge summary here</p>
            <p class="upload-subtext">Supports PDF, JPG, PNG files (max 10MB)</p>
            <button class="btn btn-secondary" onclick="document.getElementById('fileInput').click()">Browse Files</button>
        </div>
    `;
}

// Enhanced file upload function
async function handleFileUpload(file) {
    console.log('Starting file upload:', file.name, file.type, file.size);
    
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    // Validate file
    if (!file) {
        showMessage('❌ Please select a file to upload.', 'error');
        return;
    }

    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
        showMessage('❌ File too large. Maximum size is 100MB.', 'error');
        return;
    }

    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
        showMessage('❌ Invalid file type. Please upload PDF, JPG, PNG, or text files.', 'error');
        return;
    }

    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    // Show progress
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Preparing upload...';

    try {
        // Simulate upload progress
        for (let i = 0; i <= 100; i += 20) {
            progressFill.style.width = i + '%';
            progressText.textContent = `Uploading... ${i}%`;
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Create FormData
        const formData = new FormData();
        formData.append('prescription', file);
        formData.append('patientId', currentPatient.id);
        formData.append('clinicalNotes', document.getElementById('clinicalNotes').value);
        formData.append('currentMeds', document.getElementById('currentMeds').value);

        console.log('Sending upload request...');
        
        const response = await fetch('/api/upload-prescription', {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header for FormData - browser will set it automatically
        });

        console.log('Upload response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Upload result:', result);
        
        if (result.success) {
            progressFill.style.width = '100%';
            progressText.textContent = 'Upload complete! Analyzing...';
            
            // Simulate analysis delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            progressText.textContent = 'Analysis complete!';
            
            currentAnalysis = result.analysis;
            
            // Update UI with results
            document.getElementById('aiSuggestions').value = result.analysis;
            
            showMessage(`✅ File "${file.name}" uploaded and analyzed successfully!`, 'success');
            addToChat(`AI Assistant: I've analyzed the uploaded document "${file.name}". ${result.analysis.substring(0, 100)}...`);
            
            // Hide progress after delay
            setTimeout(() => {
                progressContainer.style.display = 'none';
                updateUploadAreaContent();
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        progressText.textContent = 'Upload failed';
        progressFill.style.background = '#dc3545';
        
        showMessage('❌ Upload failed: ' + error.message, 'error');
        addToChat('AI Assistant: Sorry, there was an error uploading the file. Please try again.');
        
        // Reset after error
        setTimeout(() => {
            progressContainer.style.display = 'none';
            updateUploadAreaContent();
        }, 3000);
    }
}

// Test upload function
async function testUpload() {
    console.log('Testing upload functionality...');
    
    // Create a test file
    const testContent = 'This is a test prescription document.';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    testFile.name = 'test-prescription.txt';
    
    // Simulate current patient for testing
    if (!currentPatient) {
        currentPatient = {
            id: 'test-patient',
            name: 'Test Patient',
            gender: 'Female',
            clinicalNotes: 'Test clinical notes',
            currentMeds: 'Test medications'
        };
        showMessage('✅ Test patient created for upload test', 'info');
    }
    
    await handleFileUpload(testFile);
}
// ICD-10 Code Management
function addIcd10Code() {
    const codeInput = document.getElementById('icd10Code');
    const code = codeInput.value.trim();
    
    if (code) {
        icd10Codes.push(code);
        codeInput.value = '';
        updateCodeList();
        showMessage('ICD-10 code added.', 'success');
    }
}

function updateCodeList() {
    const codeList = document.getElementById('codeList');
    codeList.innerHTML = '<strong>Current ICD-10 Codes:</strong><br>';
    
    icd10Codes.forEach((code, index) => {
        codeList.innerHTML += `
            <div class="code-item">
                ${code}
                <button class="btn btn-small" onclick="removeCode(${index})">Remove</button>
            </div>
        `;
    });
}

function removeCode(index) {
    icd10Codes.splice(index, 1);
    updateCodeList();
}

// Medication Management
function addMedication() {
    const medicationList = document.getElementById('medicationList');
    const newMed = document.createElement('div');
    newMed.className = 'medication-item';
    newMed.innerHTML = `
        <input type="text" placeholder="Medication name" class="med-name">
        <input type="number" placeholder="Cost" class="med-cost" step="0.01">
        <button class="btn btn-small" onclick="removeMedication(this)">Remove</button>
    `;
    medicationList.appendChild(newMed);
}

function removeMedication(button) {
    button.parentElement.remove();
    updateBillingSummary();
}

function updateBillingSummary() {
    const billingDetails = document.getElementById('billingDetails');
    const totalAmount = document.getElementById('totalAmount');
    
    let total = 0;
    let html = '';
    
    // Get medications from inputs
    const medItems = document.querySelectorAll('.medication-item');
    medications = [];
    
    medItems.forEach(item => {
        const name = item.querySelector('.med-name').value;
        const cost = parseFloat(item.querySelector('.med-cost').value) || 0;
        
        if (name) {
            medications.push({ name, cost });
            total += cost;
            html += `<div>${name}: $${cost.toFixed(2)}</div>`;
        }
    });
    
    // Add consultation fee
    const consultationFee = 75.00;
    total += consultationFee;
    html += `<div>Consultation Fee: $${consultationFee.toFixed(2)}</div>`;
    
    billingDetails.innerHTML = html;
    totalAmount.textContent = `Total: $${total.toFixed(2)}`;
    
    return total;
}

// AI Chat Functionality
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    if (!message) return;
    
    addToChat(`You: ${message}`);
    userInput.value = '';
    
    // Simulate AI response
    addToChat('AI Assistant: Thinking...');
    
    try {
        const response = await fetch('/api/ai-consult', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                patientData: currentPatient,
                icd10Codes: icd10Codes
            })
        });
        
        const result = await response.json();
        
        // Remove "Thinking..." message
        const chatBox = document.getElementById('chatBox');
        chatBox.removeChild(chatBox.lastChild);
        
        addToChat(`AI Assistant: ${result.response}`);
    } catch (error) {
        console.error('AI chat error:', error);
        // Remove "Thinking..." message
        const chatBox = document.getElementById('chatBox');
        chatBox.removeChild(chatBox.lastChild);
        
        addToChat('AI Assistant: Sorry, I\'m having trouble responding. Please try again.');
    }
}

function addToChat(message) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    
    if (message.startsWith('You:')) {
        messageDiv.className = 'user-message';
    } else {
        messageDiv.className = 'ai-message';
    }
    
    messageDiv.innerHTML = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Fixed Generate Bill Function
async function generateBill() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    if (medications.length === 0) {
        showMessage('❌ Please add at least one medication for billing.', 'error');
        return;
    }

    if (icd10Codes.length === 0) {
        showMessage('❌ Please add at least one ICD-10 code.', 'error');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '📊 Generating Bill...';
    button.disabled = true;

    const totalAmount = updateBillingSummary();
    const aiSuggestions = document.getElementById('aiSuggestions').value || currentAnalysis || 'AI recommendations will appear here after analysis.';

    const billData = {
        patientData: {
            id: currentPatient.id,
            name: currentPatient.name,
            gender: currentPatient.gender,
            clinicalNotes: currentPatient.clinicalNotes,
            currentMeds: currentPatient.currentMeds
        },
        medications: medications,
        icd10Codes: icd10Codes,
        aiSuggestions: aiSuggestions,
        totalAmount: totalAmount
    };

    console.log('Generating bill with data:', billData);

    try {
        const response = await fetch('/api/generate-bill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(billData)
        });

        const result = await response.json();
        
        if (result.success) {
            const downloadSection = document.getElementById('downloadSection');
            const downloadLink = document.getElementById('downloadLink');
            
            downloadLink.href = result.downloadUrl;
            downloadLink.textContent = '📄 Download Bill PDF';
            downloadSection.style.display = 'block';
            
            showMessage(`✅ Bill generated successfully for ${currentPatient.name}!`, 'success');
            addToChat(`AI Assistant: Bill has been generated for ${currentPatient.name} with ${medications.length} medications and ${icd10Codes.length} ICD-10 codes.`);
            
            // Auto-scroll to download section
            downloadSection.scrollIntoView({ behavior: 'smooth' });
            
        } else {
            throw new Error(result.error || 'Failed to generate bill');
        }
        
    } catch (error) {
        console.error('Bill generation error:', error);
        showMessage('❌ Error generating bill: ' + error.message, 'error');
        addToChat('AI Assistant: Sorry, there was an error generating the bill. Please try again.');
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Enhanced updateBillingSummary function
function updateBillingSummary() {
    const billingDetails = document.getElementById('billingDetails');
    const totalAmount = document.getElementById('totalAmount');
    
    let total = 0;
    let html = '';
    
    // Get medications from inputs
    const medItems = document.querySelectorAll('.medication-item');
    medications = [];
    
    medItems.forEach(item => {
        const name = item.querySelector('.med-name').value;
        const cost = parseFloat(item.querySelector('.med-cost').value) || 0;
        
        if (name && cost > 0) {
            medications.push({ name, cost });
            total += cost;
            html += `<div>${name}: $${cost.toFixed(2)}</div>`;
        }
    });
    
    // Add consultation fee
    const consultationFee = 75.00;
    total += consultationFee;
    html += `<div><strong>Consultation Fee: $${consultationFee.toFixed(2)}</strong></div>`;
    
    // Add ICD-10 coding fee if codes exist
    if (icd10Codes.length > 0) {
        const codingFee = icd10Codes.length * 15.00;
        total += codingFee;
        html += `<div>Medical Coding (${icd10Codes.length} codes): $${codingFee.toFixed(2)}</div>`;
    }
    
    billingDetails.innerHTML = html;
    totalAmount.textContent = `Total: $${total.toFixed(2)}`;
    
    return total;
}
// Fixed Generate Bill Function
async function generateBill() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    if (medications.length === 0) {
        showMessage('❌ Please add at least one medication for billing.', 'error');
        return;
    }

    if (icd10Codes.length === 0) {
        showMessage('❌ Please add at least one ICD-10 code.', 'error');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '📊 Generating Bill...';
    button.disabled = true;

    const totalAmount = updateBillingSummary();
    const aiSuggestions = document.getElementById('aiSuggestions').value || currentAnalysis || 'AI recommendations will appear here after analysis.';

    const billData = {
        patientData: {
            id: currentPatient.id,
            name: currentPatient.name,
            gender: currentPatient.gender,
            clinicalNotes: currentPatient.clinicalNotes,
            currentMeds: currentPatient.currentMeds
        },
        medications: medications,
        icd10Codes: icd10Codes,
        aiSuggestions: aiSuggestions,
        totalAmount: totalAmount
    };

    console.log('Generating bill with data:', billData);

    try {
        const response = await fetch('/api/generate-bill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(billData)
        });

        const result = await response.json();
        
        if (result.success) {
            const downloadSection = document.getElementById('downloadSection');
            const downloadLink = document.getElementById('downloadLink');
            
            downloadLink.href = result.downloadUrl;
            downloadLink.textContent = '📄 Download Bill PDF';
            downloadSection.style.display = 'block';
            
            showMessage(`✅ Bill generated successfully for ${currentPatient.name}!`, 'success');
            addToChat(`AI Assistant: Bill has been generated for ${currentPatient.name} with ${medications.length} medications and ${icd10Codes.length} ICD-10 codes.`);
            
            // Auto-scroll to download section
            downloadSection.scrollIntoView({ behavior: 'smooth' });
            
        } else {
            throw new Error(result.error || 'Failed to generate bill');
        }
        
    } catch (error) {
        console.error('Bill generation error:', error);
        showMessage('❌ Error generating bill: ' + error.message, 'error');
        addToChat('AI Assistant: Sorry, there was an error generating the bill. Please try again.');
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}
// Enhanced updateBillingSummary function
function updateBillingSummary() {
    const billingDetails = document.getElementById('billingDetails');
    const totalAmount = document.getElementById('totalAmount');
    
    let total = 0;
    let html = '';
    
    // Get medications from inputs
    const medItems = document.querySelectorAll('.medication-item');
    medications = [];
    
    medItems.forEach(item => {
        const name = item.querySelector('.med-name').value;
        const cost = parseFloat(item.querySelector('.med-cost').value) || 0;
        
        if (name && cost > 0) {
            medications.push({ name, cost });
            total += cost;
            html += `<div>${name}: $${cost.toFixed(2)}</div>`;
        }
    });
    
    // Add consultation fee
    const consultationFee = 75.00;
    total += consultationFee;
    html += `<div><strong>Consultation Fee: $${consultationFee.toFixed(2)}</strong></div>`;
    
    // Add ICD-10 coding fee if codes exist
    if (icd10Codes.length > 0) {
        const codingFee = icd10Codes.length * 15.00;
        total += codingFee;
        html += `<div>Medical Coding (${icd10Codes.length} codes): $${codingFee.toFixed(2)}</div>`;
    }
    
    billingDetails.innerHTML = html;
    totalAmount.textContent = `Total: $${total.toFixed(2)}`;
    
    return total;
}

// Fixed autoCompleteAllBilling function
async function autoCompleteAllBilling() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    const clinicalNotes = document.getElementById('clinicalNotes').value.trim();
    const currentMeds = document.getElementById('currentMeds').value.trim();
    
    if (!clinicalNotes) {
        showMessage('❌ Please enter clinical notes first.', 'warning');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '🚀 AI Completing Billing...';
    button.disabled = true;

    showMessage(`AI is completing all billing information for ${currentPatient.name}...`, 'info');
    
    try {
        const response = await fetch('/api/auto-complete-billing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clinicalNotes, currentMeds })
        });

        const result = await response.json();
        
        if (result.success) {
            // Auto-add ICD-10 codes
            icd10Codes = [];
            result.suggestedCodes.forEach(code => {
                const codeWithoutDescription = code.split(/[ -]/)[0].trim();
                if (codeWithoutDescription && !icd10Codes.includes(codeWithoutDescription)) {
                    icd10Codes.push(codeWithoutDescription);
                }
            });
            updateCodeList();
            
            // Auto-add medications
            const medicationList = document.getElementById('medicationList');
            medicationList.innerHTML = '';
            
            if (result.suggestedMedications && result.suggestedMedications.length > 0) {
                result.suggestedMedications.forEach(med => {
                    addMedicationItem(med.name, med.cost);
                });
            } else {
                // Add default medications if AI returns none
                addMedicationItem('Acetaminophen 500mg', 15.00);
                addMedicationItem('Dextromethorphan 15mg', 12.50);
            }
            
            updateBillingSummary();
            
            showMessage(`✅ AI completed billing with ${icd10Codes.length} codes and ${medications.length} medications!`, 'success');
            addToChat(`AI Assistant: I've automatically completed billing for ${currentPatient.name} with ${icd10Codes.length} ICD-10 codes and ${medications.length} medications.`);
            
            // Auto-generate the bill after completion
            setTimeout(() => {
                generateBill();
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Failed to auto-complete billing');
        }
        
    } catch (error) {
        console.error('Auto-complete billing error:', error);
        showMessage('❌ Error auto-completing billing. Please add information manually.', 'error');
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Export ICD-10 Codes
function exportIcd10Codes() {
    if (icd10Codes.length === 0) {
        showMessage('No ICD-10 codes to export.', 'warning');
        return;
    }
    
    const data = {
        patient: currentPatient,
        icd10Codes: icd10Codes,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icd10-codes-${Date.now()}.json`;
    a.click();
    
    showMessage('ICD-10 codes exported successfully!', 'success');
}

// Utility Functions
function showMessage(message, type) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        transition: all 0.3s;
    `;
    
    toast.style.background = type === 'success' ? '#28a745' : 
                            type === 'error' ? '#dc3545' : 
                            type === 'warning' ? '#ffc107' : '#007bff';
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Allow sending message with Enter key
document.getElementById('userInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
// AI Automation Functions
// Fixed AI Automation Functions
async function autoSuggestCodes() {
    const clinicalNotes = document.getElementById('clinicalNotes').value.trim();
    
    if (!clinicalNotes) {
        showMessage('Please enter clinical notes first.', 'warning');
        return;
    }

    if (clinicalNotes.length < 5) {
        showMessage('Please enter more detailed clinical notes (at least 5 characters).', 'warning');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '🔄 AI Analyzing...';
    button.disabled = true;

    showMessage('AI is analyzing clinical notes for ICD-10 codes...', 'info');
    
    try {
        const response = await fetch('/api/auto-suggest-codes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clinicalNotes })
        });

        const result = await response.json();
        
        if (result.success) {
            // Clear existing codes
            icd10Codes = [];
            
            // Add suggested codes automatically
            result.suggestedCodes.forEach(code => {
                // Extract just the code part (before the first space or dash)
                const codePart = code.split(/[ -]/)[0].trim();
                if (codePart && !icd10Codes.includes(codePart)) {
                    icd10Codes.push(codePart);
                }
            });
            
            updateCodeList();
            showMessage(`✅ AI added ${icd10Codes.length} ICD-10 codes automatically!`, 'success');
            addToChat(`AI Assistant: I've analyzed your clinical notes and automatically added ${icd10Codes.length} relevant ICD-10 codes.`);
            
        } else {
            throw new Error(result.error || 'Failed to generate codes');
        }
        
    } catch (error) {
        console.error('Auto-suggest codes error:', error);
        showMessage('❌ Error generating ICD-10 codes. Using fallback codes.', 'error');
        
        // Use fallback codes
        const fallbackCodes = getFallbackCodesFromNotes(clinicalNotes);
        icd10Codes = fallbackCodes;
        updateCodeList();
        addToChat(`AI Assistant: I've added fallback ICD-10 codes based on your clinical notes.`);
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Local fallback function for frontend
function getFallbackCodesFromNotes(clinicalNotes) {
    const lowerNotes = clinicalNotes.toLowerCase();
    const codes = [];

    if (lowerNotes.includes('respiratory') || lowerNotes.includes('cough') || lowerNotes.includes('cold')) {
        codes.push('J06.9');
    }
    if (lowerNotes.includes('fever')) {
        codes.push('R50.9');
    }
    if (lowerNotes.includes('hypertension') || lowerNotes.includes('blood pressure')) {
        codes.push('I10');
    }
    if (lowerNotes.includes('diabetes')) {
        codes.push('E11.9');
    }
    if (lowerNotes.includes('headache')) {
        codes.push('R51');
    }
    if (lowerNotes.includes('pain')) {
        codes.push('R52');
    }
    
    if (codes.length === 0) {
        codes.push('R69');
    }
    
    return codes;
}

// Test AI connection
async function testAIConnection() {
    try {
        const response = await fetch('/api/test-ai');
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ AI is connected and working!', 'success');
            console.log('Test results:', result);
        } else {
            showMessage('❌ AI connection issue', 'error');
        }
    } catch (error) {
        showMessage('❌ Cannot connect to AI server', 'error');
    }
}

// Enhanced code list display
function updateCodeList() {
    const codeList = document.getElementById('codeList');
    
    if (icd10Codes.length === 0) {
        codeList.innerHTML = '<div class="no-codes">No ICD-10 codes added yet. Use AI suggestion or add manually.</div>';
        return;
    }
    
    codeList.innerHTML = '<strong>Current ICD-10 Codes:</strong><br>';
    
    icd10Codes.forEach((code, index) => {
        codeList.innerHTML += `
            <div class="code-item">
                <span class="code-text">${code}</span>
                <button class="btn btn-small btn-danger" onclick="removeCode(${index})">×</button>
            </div>
        `;
    });
}

// Enhanced manual code addition
function addIcd10Code() {
    const codeInput = document.getElementById('icd10Code');
    const code = codeInput.value.trim();
    
    if (code) {
        // Validate basic code format (letter followed by numbers and optional decimals)
        if (/^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/.test(code)) {
            icd10Codes.push(code);
            codeInput.value = '';
            updateCodeList();
            showMessage('ICD-10 code added successfully!', 'success');
        } else {
            showMessage('Please enter a valid ICD-10 code format (e.g., J06.9, I10, E11.9)', 'warning');
        }
    } else {
        showMessage('Please enter an ICD-10 code.', 'warning');
    }
}

async function autoSuggestMedications() {
    const clinicalNotes = document.getElementById('clinicalNotes').value;
    const currentMeds = document.getElementById('currentMeds').value;
    
    if (!clinicalNotes.trim()) {
        showMessage('Please enter clinical notes first.', 'warning');
        return;
    }

    showMessage('AI is analyzing clinical notes for medications...', 'info');
    
    try {
        const response = await fetch('/api/auto-suggest-medications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clinicalNotes, currentMeds })
        });

        const result = await response.json();
        
        if (result.success) {
            // Clear existing medications
            const medicationList = document.getElementById('medicationList');
            medicationList.innerHTML = '';
            
            // Add suggested medications automatically
            result.suggestedMedications.forEach(med => {
                addMedicationItem(med.name, med.cost);
            });
            
            updateBillingSummary();
            showMessage(`AI added ${result.suggestedMedications.length} medications automatically!`, 'success');
            addToChat(`AI Assistant: I've automatically suggested ${result.suggestedMedications.length} medications with pricing.`);
        }
    } catch (error) {
        console.error('Auto-suggest medications error:', error);
        showMessage('Error generating medications.', 'error');
    }
}

async function autoCompleteAllBilling() {
    const clinicalNotes = document.getElementById('clinicalNotes').value;
    const currentMeds = document.getElementById('currentMeds').value;
    
    if (!clinicalNotes.trim()) {
        showMessage('Please enter clinical notes first.', 'warning');
        return;
    }

    showMessage('AI is completing all billing information...', 'info');
    
    try {
        const response = await fetch('/api/auto-complete-billing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clinicalNotes, currentMeds })
        });

        const result = await response.json();
        
        if (result.success) {
            // Auto-add ICD-10 codes
            icd10Codes = [];
            result.suggestedCodes.forEach(code => {
                const codeWithoutDescription = code.split(' - ')[0];
                icd10Codes.push(codeWithoutDescription);
            });
            updateCodeList();
            
            // Auto-add medications
            const medicationList = document.getElementById('medicationList');
            medicationList.innerHTML = '';
            result.suggestedMedications.forEach(med => {
                addMedicationItem(med.name, med.cost);
            });
            
            updateBillingSummary();
            
            showMessage('AI completed all billing information automatically!', 'success');
            addToChat(`AI Assistant: I've automatically completed billing with ${result.suggestedCodes.length} ICD-10 codes and ${result.suggestedMedications.length} medications.`);
        }
    } catch (error) {
        console.error('Auto-complete billing error:', error);
        showMessage('Error auto-completing billing.', 'error');
    }
}

// Helper function to add medication items
function addMedicationItem(name, cost) {
    const medicationList = document.getElementById('medicationList');
    const newMed = document.createElement('div');
    newMed.className = 'medication-item';
    newMed.innerHTML = `
        <input type="text" placeholder="Medication name" class="med-name" value="${name}">
        <input type="number" placeholder="Cost" class="med-cost" step="0.01" value="${cost}">
        <button class="btn btn-small" onclick="removeMedication(this)">Remove</button>
    `;
    medicationList.appendChild(newMed);
}

// Fixed updateBillingSummary function
function updateBillingSummary() {
    const billingDetails = document.getElementById('billingDetails');
    const totalAmount = document.getElementById('totalAmount');
    
    let total = 0;
    let html = '';
    
    // Clear and rebuild medications array
    medications = [];
    const medItems = document.querySelectorAll('.medication-item');
    
    medItems.forEach((item, index) => {
        const nameInput = item.querySelector('.med-name');
        const costInput = item.querySelector('.med-cost');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const cost = costInput ? parseFloat(costInput.value) || 0 : 0;
        
        if (name && cost > 0) {
            medications.push({ name, cost });
            total += cost;
            html += `<div>${name}: $${cost.toFixed(2)}</div>`;
        } else if (name && cost === 0) {
            // Show medication with zero cost (needs attention)
            medications.push({ name, cost: 0 });
            html += `<div style="color: #dc3545;">${name}: $0.00 (please set cost)</div>`;
        }
    });
    
    // Add consultation fee
    const consultationFee = 75.00;
    total += consultationFee;
    html += `<div><strong>Consultation Fee: $${consultationFee.toFixed(2)}</strong></div>`;
    
    // Add ICD-10 coding fee if codes exist
    if (icd10Codes.length > 0) {
        const codingFee = icd10Codes.length * 15.00;
        total += codingFee;
        html += `<div>Medical Coding (${icd10Codes.length} codes): $${codingFee.toFixed(2)}</div>`;
    }
    
    billingDetails.innerHTML = html;
    totalAmount.textContent = `Total: $${total.toFixed(2)}`;
    
    console.log('Billing Summary Updated:', { medications, total });
    return total;
}

// Fixed addMedication function
function addMedication() {
    const medicationList = document.getElementById('medicationList');
    const newMed = document.createElement('div');
    newMed.className = 'medication-item';
    newMed.innerHTML = `
        <input type="text" placeholder="Medication name" class="med-name" oninput="updateBillingSummary()">
        <input type="number" placeholder="Cost" class="med-cost" step="0.01" min="0" value="0" oninput="updateBillingSummary()">
        <button class="btn btn-small btn-danger" onclick="removeMedication(this)">×</button>
    `;
    medicationList.appendChild(newMed);
    updateBillingSummary();
}

// Fixed addMedicationItem function
function addMedicationItem(name, cost) {
    const medicationList = document.getElementById('medicationList');
    const newMed = document.createElement('div');
    newMed.className = 'medication-item';
    newMed.innerHTML = `
        <input type="text" placeholder="Medication name" class="med-name" value="${name}" oninput="updateBillingSummary()">
        <input type="number" placeholder="Cost" class="med-cost" step="0.01" min="0" value="${cost}" oninput="updateBillingSummary()">
        <button class="btn btn-small btn-danger" onclick="removeMedication(this)">×</button>
    `;
    medicationList.appendChild(newMed);
    updateBillingSummary();
}

// Fixed removeMedication function
function removeMedication(button) {
    button.parentElement.remove();
    updateBillingSummary();
}

// Enhanced generateBill function with better validation
async function generateBill() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    // Update billing summary to get current data
    const totalAmount = updateBillingSummary();
    
    // Validate medications have costs
    const invalidMeds = medications.filter(med => med.cost <= 0);
    if (invalidMeds.length > 0) {
        showMessage(`❌ Please set costs for: ${invalidMeds.map(med => med.name).join(', ')}`, 'error');
        return;
    }

    if (medications.length === 0) {
        showMessage('❌ Please add at least one medication for billing.', 'error');
        return;
    }

    if (icd10Codes.length === 0) {
        showMessage('❌ Please add at least one ICD-10 code.', 'error');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '📊 Generating Bill...';
    button.disabled = true;

    const aiSuggestions = document.getElementById('aiSuggestions').value || currentAnalysis || 'No AI recommendations provided.';

    const billData = {
        patientData: {
            id: currentPatient.id,
            name: currentPatient.name,
            gender: currentPatient.gender,
            clinicalNotes: currentPatient.clinicalNotes,
            currentMeds: currentPatient.currentMeds
        },
        medications: medications,
        icd10Codes: icd10Codes,
        aiSuggestions: aiSuggestions,
        totalAmount: totalAmount
    };

    console.log('Generating bill with data:', billData);

    try {
        const response = await fetch('/api/generate-bill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(billData)
        });

        const result = await response.json();
        
        if (result.success) {
            const downloadSection = document.getElementById('downloadSection');
            const downloadLink = document.getElementById('downloadLink');
            
            downloadLink.href = result.downloadUrl;
            downloadLink.textContent = '📄 Download Bill PDF';
            downloadSection.style.display = 'block';
            
            showMessage(`✅ Bill generated successfully for ${currentPatient.name}!`, 'success');
            addToChat(`AI Assistant: Bill has been generated for ${currentPatient.name} with ${medications.length} medications and ${icd10Codes.length} ICD-10 codes. Total: $${totalAmount.toFixed(2)}`);
            
            // Auto-scroll to download section
            downloadSection.scrollIntoView({ behavior: 'smooth' });
            
        } else {
            throw new Error(result.error || 'Failed to generate bill');
        }
        
    } catch (error) {
        console.error('Bill generation error:', error);
        showMessage('❌ Error generating bill: ' + error.message, 'error');
        addToChat('AI Assistant: Sorry, there was an error generating the bill. Please check the console for details.');
    } finally {
        // Restore button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Add real-time cost validation
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for cost inputs
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('med-cost')) {
            // Validate cost input
            const cost = parseFloat(e.target.value);
            if (cost < 0) {
                e.target.value = 0;
            }
            updateBillingSummary();
        }
    });
});
// SIMPLE GUARANTEED BILL GENERATOR
async function generateBill() {
    console.log('🚀 Starting bill generation...');
    
    // Check basic requirements
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }

    // Get current data
    const totalAmount = updateBillingSummary();
    
    // Validate data
    if (medications.length === 0) {
        showMessage('❌ Please add at least one medication.', 'error');
        return;
    }

    // Show loading
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '📊 Creating PDF...';
    button.disabled = true;

    try {
        // Create simple PDF using browser's print functionality
        await createSimplePDF();
        
        showMessage('✅ Bill generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        // Fallback: Download as text file
        downloadAsTextFile();
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Method 1: Simple PDF using browser print
function createSimplePDF() {
    return new Promise((resolve) => {
        // Create bill content
        const billContent = createBillContent();
        
        // Create a new window with the bill content
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Medical Bill - ${currentPatient.name}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 40px; 
                        line-height: 1.6;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 2px solid #007bff;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .section { 
                        margin-bottom: 20px; 
                    }
                    .medication { 
                        margin-left: 20px; 
                    }
                    .total { 
                        font-size: 1.2em; 
                        font-weight: bold; 
                        text-align: right;
                        margin-top: 20px;
                        border-top: 2px solid #333;
                        padding-top: 10px;
                    }
                    @media print {
                        body { margin: 20px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${billContent}
                <div class="no-print" style="margin-top: 30px; text-align: center;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🖨️ Print as PDF
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                        ❌ Close
                    </button>
                </div>
                <script>
                    // Auto-print after a short delay
                    setTimeout(() => {
                        window.print();
                    }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        resolve();
    });
}

// Method 2: Download as text file (fallback)
function downloadAsTextFile() {
    const billContent = createBillContent();
    const blob = new Blob([billContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-bill-${currentPatient.name}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('✅ Bill downloaded as text file!', 'success');
}
// Quick download function - guaranteed to work
function quickDownload() {
    if (!currentPatient) {
        showMessage('❌ Please save patient information first.', 'error');
        return;
    }
    
    if (medications.length === 0) {
        showMessage('❌ Please add at least one medication.', 'error');
        return;
    }
    
    // Create simple text bill
    const totalAmount = updateBillingSummary();
    const billText = `
MEDICAL BILLING STATEMENT
=========================

Patient: ${currentPatient.name}
Gender: ${currentPatient.gender}
Date: ${new Date().toLocaleDateString()}
Bill ID: B${Date.now()}

CLINICAL NOTES:
${currentPatient.clinicalNotes}

MEDICATIONS:
${medications.map(med => `• ${med.name}: $${med.cost.toFixed(2)}`).join('\n')}

Consultation Fee: $75.00
Medical Coding: $${(icd10Codes.length * 15).toFixed(2)}

ICD-10 CODES:
${icd10Codes.map(code => `• ${code}`).join('\n')}

TOTAL AMOUNT: $${totalAmount.toFixed(2)}

Generated by Medical AI Assistant System
This is an AI-generated medical bill.
Please verify all information with healthcare professionals.
    `;
    
    // Download as text file
    const blob = new Blob([billText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Medical-Bill-${currentPatient.name}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('✅ Bill downloaded successfully!', 'success');
    addToChat(`AI Assistant: Bill for ${currentPatient.name} has been downloaded. Total: $${totalAmount.toFixed(2)}`);
}
