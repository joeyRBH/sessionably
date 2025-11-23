// Test script for Insurance Benefits Verification
// This script tests the insurance verification API endpoint

const testInsuranceVerification = async () => {
    console.log('🧪 Testing Insurance Benefits Verification...\n');

    const baseUrl = 'http://localhost:3000';
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Test Connection Endpoint
    console.log('Test 1: Testing Availity connection endpoint...');
    try {
        const response = await fetch(`${baseUrl}/api/insurance-verification/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Test connection successful');
            console.log('   Response:', JSON.stringify(data, null, 2));
            testsPassed++;
        } else {
            console.log('❌ Test connection failed');
            console.log('   Response:', JSON.stringify(data, null, 2));
            testsFailed++;
        }
    } catch (error) {
        console.log('❌ Test connection error:', error.message);
        testsFailed++;
    }

    console.log('');

    // Test 2: Mock Eligibility Verification
    console.log('Test 2: Testing eligibility verification with mock data...');
    try {
        const verificationRequest = {
            patient_id: 1, // Assuming there's a patient with ID 1
            member_id: 'TEST123456',
            payer_id: 'BCBS',
            service_type: '30' // Mental health
        };

        const response = await fetch(`${baseUrl}/api/insurance-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(verificationRequest)
        });

        const data = await response.json();

        if (response.status === 201) {
            console.log('✅ Eligibility verification successful');
            console.log('   Verification ID:', data.id);
            console.log('   Status:', data.status);
            console.log('   Deductible:', data.deductible);
            console.log('   Copay:', data.copay);
            console.log('   Coinsurance:', data.coinsurance);
            console.log('   Out of Pocket Max:', data.out_of_pocket_max);
            testsPassed++;
        } else {
            console.log('❌ Eligibility verification failed');
            console.log('   Status:', response.status);
            console.log('   Response:', JSON.stringify(data, null, 2));
            testsFailed++;
        }
    } catch (error) {
        console.log('❌ Eligibility verification error:', error.message);
        testsFailed++;
    }

    console.log('');

    // Test 3: Get Verifications
    console.log('Test 3: Retrieving verification records...');
    try {
        const response = await fetch(`${baseUrl}/api/insurance-verification`, {
            method: 'GET'
        });

        const data = await response.json();

        if (response.ok && Array.isArray(data)) {
            console.log(`✅ Retrieved ${data.length} verification records`);
            if (data.length > 0) {
                console.log('   Latest verification:');
                console.log('   - Patient:', data[0].patient_name);
                console.log('   - Member ID:', data[0].member_id);
                console.log('   - Status:', data[0].status);
            }
            testsPassed++;
        } else {
            console.log('❌ Failed to retrieve verifications');
            console.log('   Response:', JSON.stringify(data, null, 2));
            testsFailed++;
        }
    } catch (error) {
        console.log('❌ Retrieve verifications error:', error.message);
        testsFailed++;
    }

    console.log('');
    console.log('='.repeat(50));
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log('='.repeat(50));

    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed! Insurance verification is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the errors above.');
    }
};

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testInsuranceVerification };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.testInsuranceVerification = testInsuranceVerification;
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    testInsuranceVerification().catch(console.error);
}
