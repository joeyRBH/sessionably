// ================================
// INSURANCE FEATURE - JAVASCRIPT FUNCTIONS
// Archived from app.html
// Lines: 9056-9505+
// ================================

function showInsuranceTab(tab) {
    document.querySelectorAll('.insurance-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('insurance' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').style.display = 'block';
    event.target.classList.add('active');

    // Load data when switching tabs
    if (tab === 'claims') {
        loadClaims();
    } else if (tab === 'verification') {
        loadVerifications();
    } else if (tab === 'settings') {
        loadInsuranceSettings();
    }
}

// Load insurance claims
async function loadClaims() {
    try {
        const response = await fetch('/api/insurance-claims', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load claims');
        }

        const claims = await response.json();
        displayClaims(claims);
        updateClaimsStats(claims);
    } catch (error) {
        console.error('Error loading claims:', error);
        showNotification('Failed to load claims', 'error');
    }
}

// Display claims in the list
function displayClaims(claims) {
    const claimsList = document.getElementById('claimsList');

    if (!claims || claims.length === 0) {
        claimsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6B7280;">
                <p>No claims found. Submit your first claim to get started.</p>
            </div>
        `;
        return;
    }

    const claimsHtml = claims.map(claim => `
        <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0;">Claim #${claim.claim_number || claim.id}</h4>
                    <p style="margin: 0; color: #6B7280;">
                        Patient: ${claim.patient_name || 'N/A'}<br>
                        Service Date: ${claim.service_date ? new Date(claim.service_date).toLocaleDateString() : 'N/A'}<br>
                        CPT Code: ${claim.cpt_code || 'N/A'}<br>
                        Amount: $${parseFloat(claim.amount || 0).toFixed(2)}
                    </p>
                </div>
                <div style="text-align: right;">
                    <span class="status-badge status-${claim.status}">${claim.status}</span>
                    <div style="margin-top: 10px;">
                        <button class="btn btn-small" onclick="viewClaimDetails('${claim.id}')">View</button>
                        ${claim.status === 'denied' ? `<button class="btn btn-small" onclick="resubmitClaim('${claim.id}')">Resubmit</button>` : ''}
                    </div>
                </div>
            </div>
            ${claim.denial_reason ? `
                <div style="margin-top: 12px; padding: 12px; background: #FEE2E2; border-radius: 6px; color: #991B1B;">
                    <strong>Denial Reason:</strong> ${claim.denial_reason}
                </div>
            ` : ''}
        </div>
    `).join('');

    claimsList.innerHTML = claimsHtml;
}

// Update claims statistics
function updateClaimsStats(claims) {
    const pending = claims.filter(c => c.status === 'pending' || c.status === 'submitted').length;
    const approved = claims.filter(c => c.status === 'approved').length;
    const denied = claims.filter(c => c.status === 'denied').length;
    const totalClaimed = claims.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

    document.getElementById('pendingClaimsCount').textContent = pending;
    document.getElementById('approvedClaimsCount').textContent = approved;
    document.getElementById('deniedClaimsCount').textContent = denied;
    document.getElementById('totalClaimedAmount').textContent = '$' + totalClaimed.toFixed(2);
}

// Filter claims by status
function filterClaims() {
    const status = document.getElementById('claimStatusFilter').value;
    loadClaims(status);
}

// Open verify benefits modal
function openVerifyBenefits() {
    // Create and show modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'verifyBenefitsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Verify Insurance Benefits</h2>
                <span class="close" onclick="closeModal('verifyBenefitsModal')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="verifyPatientId">Select Patient:</label>
                    <select id="verifyPatientId" class="input" required>
                        <option value="">Select a patient...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="verifyInsuranceId">Insurance Member ID:</label>
                    <input type="text" id="verifyInsuranceId" class="input" required>
                </div>
                <div class="form-group">
                    <label for="verifyPayerId">Payer/Insurance Company:</label>
                    <input type="text" id="verifyPayerId" class="input" placeholder="e.g., Anthem, BCBS, Aetna" required>
                </div>
                <div class="form-group">
                    <label for="verifyServiceType">Service Type:</label>
                    <select id="verifyServiceType" class="input">
                        <option value="30">Health Benefit Plan Coverage (30)</option>
                        <option value="98">Professional (Physician) Visit - Office (98)</option>
                        <option value="MH">Mental Health (MH)</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn" onclick="closeModal('verifyBenefitsModal')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="submitVerifyBenefits()">Verify Benefits</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Load patients into dropdown
    loadPatientsForVerification();
}

// Load patients into verification dropdown
async function loadPatientsForVerification() {
    try {
        const response = await fetch('/api/clients');
        const clients = await response.json();

        const select = document.getElementById('verifyPatientId');
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.first_name} ${client.last_name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

// Submit benefits verification
async function submitVerifyBenefits() {
    const patientId = document.getElementById('verifyPatientId').value;
    const memberId = document.getElementById('verifyInsuranceId').value;
    const payerId = document.getElementById('verifyPayerId').value;
    const serviceType = document.getElementById('verifyServiceType').value;

    if (!patientId || !memberId || !payerId) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/insurance-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                patient_id: patientId,
                member_id: memberId,
                payer_id: payerId,
                service_type: serviceType
            })
        });

        if (!response.ok) {
            throw new Error('Verification failed');
        }

        const result = await response.json();
        closeModal('verifyBenefitsModal');
        showNotification('Benefits verified successfully', 'success');
        showVerificationResults(result);
    } catch (error) {
        console.error('Error verifying benefits:', error);
        showNotification('Failed to verify benefits. Please check your Availity credentials.', 'error');
    }
}

// Show verification results
function showVerificationResults(result) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'verificationResultsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Verification Results</h2>
                <span class="close" onclick="closeModal('verificationResultsModal')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="card" style="background: #D1FAE5; border-left: 4px solid #10B981;">
                    <h4 style="margin: 0 0 10px 0;">Coverage Active</h4>
                    <p style="margin: 0;"><strong>Patient:</strong> ${result.patient_name || 'N/A'}</p>
                    <p style="margin: 0;"><strong>Member ID:</strong> ${result.member_id || 'N/A'}</p>
                    <p style="margin: 0;"><strong>Payer:</strong> ${result.payer_name || 'N/A'}</p>
                </div>
                <div style="margin-top: 20px;">
                    <h4>Coverage Details:</h4>
                    <table class="settings-table">
                        <tr>
                            <td><strong>Deductible:</strong></td>
                            <td>${result.deductible || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Deductible Met:</strong></td>
                            <td>${result.deductible_met || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Co-pay:</strong></td>
                            <td>${result.copay || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Co-insurance:</strong></td>
                            <td>${result.coinsurance || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Out-of-Pocket Max:</strong></td>
                            <td>${result.out_of_pocket_max || 'N/A'}</td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeModal('verificationResultsModal')">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

// Open submit claim modal
function openSubmitClaim() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'submitClaimModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Submit Insurance Claim</h2>
                <span class="close" onclick="closeModal('submitClaimModal')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="claimPatientId">Patient:</label>
                    <select id="claimPatientId" class="input" required>
                        <option value="">Select a patient...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="claimMemberId">Insurance Member ID:</label>
                    <input type="text" id="claimMemberId" class="input" required>
                </div>
                <div class="form-group">
                    <label for="claimPayerId">Payer/Insurance Company:</label>
                    <input type="text" id="claimPayerId" class="input" placeholder="e.g., Anthem, BCBS" required>
                </div>
                <div class="form-group">
                    <label for="claimServiceDate">Service Date:</label>
                    <input type="date" id="claimServiceDate" class="input" required>
                </div>
                <div class="form-group">
                    <label for="claimCptCode">CPT Code:</label>
                    <select id="claimCptCode" class="input" required>
                        <option value="">Select CPT code...</option>
                        <option value="90791">90791 - Psychiatric Diagnostic Evaluation</option>
                        <option value="90834">90834 - Psychotherapy 45 min</option>
                        <option value="90837">90837 - Psychotherapy 60 min</option>
                        <option value="90847">90847 - Family Psychotherapy</option>
                        <option value="90853">90853 - Group Psychotherapy</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="claimDiagnosisCode">Diagnosis Code (ICD-10):</label>
                    <input type="text" id="claimDiagnosisCode" class="input" placeholder="e.g., F41.1" required>
                </div>
                <div class="form-group">
                    <label for="claimAmount">Charge Amount:</label>
                    <input type="number" id="claimAmount" class="input" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label for="claimPlaceOfService">Place of Service:</label>
                    <select id="claimPlaceOfService" class="input">
                        <option value="11">11 - Office</option>
                        <option value="02">02 - Telehealth</option>
                        <option value="12">12 - Home</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn" onclick="closeModal('submitClaimModal')">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="submitInsuranceClaim()">Submit Claim</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Load patients
    loadPatientsForClaim();
}

// Load patients for claim submission
async function loadPatientsForClaim() {
    try {
        const response = await fetch('/api/clients');
        const clients = await response.json();

        const select = document.getElementById('claimPatientId');
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.first_name} ${client.last_name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

// Submit insurance claim
async function submitInsuranceClaim() {
    const patientId = document.getElementById('claimPatientId').value;
    const memberId = document.getElementById('claimMemberId').value;
    const payerId = document.getElementById('claimPayerId').value;
    const serviceDate = document.getElementById('claimServiceDate').value;
    const cptCode = document.getElementById('claimCptCode').value;
    const diagnosisCode = document.getElementById('claimDiagnosisCode').value;
    const amount = document.getElementById('claimAmount').value;
    const placeOfService = document.getElementById('claimPlaceOfService').value;

    if (!patientId || !memberId || !payerId || !serviceDate || !cptCode || !diagnosisCode || !amount) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/insurance-claims', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                patient_id: patientId,
                member_id: memberId,
                payer_id: payerId,
                service_date: serviceDate,
                cpt_code: cptCode,
                diagnosis_code: diagnosisCode,
                amount: amount,
                place_of_service: placeOfService
            })
        });

        if (!response.ok) {
            throw new Error('Failed to submit claim');
        }

        const result = await response.json();
        closeModal('submitClaimModal');
        showNotification('Claim submitted successfully', 'success');
        loadClaims();
    } catch (error) {
        console.error('Error submitting claim:', error);
        showNotification('Failed to submit claim. Please check your configuration.', 'error');
    }
}

// Load verifications
async function loadVerifications() {
    try {
        const response = await fetch('/api/insurance-verification');
        if (!response.ok) throw new Error('Failed to load verifications');

        const verifications = await response.json();
        displayVerifications(verifications);
    } catch (error) {
        console.error('Error loading verifications:', error);
        showNotification('Failed to load verifications', 'error');
    }
}

// Display verifications
function displayVerifications(verifications) {
    const list = document.getElementById('verificationsList');

    if (!verifications || verifications.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6B7280;">
                <p>No benefit verifications found.</p>
            </div>
        `;
        return;
    }

    const html = verifications.map(v => `
        <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <h4 style="margin: 0 0 8px 0;">${v.patient_name}</h4>
                    <p style="margin: 0; color: #6B7280;">
                        Date: ${new Date(v.created_at).toLocaleDateString()}<br>
                        Payer: ${v.payer_name || 'N/A'}<br>
                        Member ID: ${v.member_id}
                    </p>
                </div>
                <div>
                    <span class="status-badge status-${v.status}">${v.status}</span>
                </div>
            </div>
        </div>
    `).join('');

    list.innerHTML = html;
}
