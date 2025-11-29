// ================================
// REPORTS FEATURE - JAVASCRIPT FUNCTIONS
// Archived from app.html
// Lines: 18072-18458
// ================================

async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const reportContent = document.getElementById('reportContent');
    const reportPreview = document.querySelector('.report-preview');
    const reportTitle = document.getElementById('reportTitle');
    const reportDate = document.getElementById('reportDate');
    const reportData = document.getElementById('reportData');

    try {
        reportContent.innerHTML = '<div class="loading">Generating report...</div>';

        // Generate report based on type
        let report = {};
        switch(reportType) {
            case 'client-summary':
                report = await generateClientSummaryReport();
                break;
            case 'appointment-trends':
                report = await generateAppointmentTrendsReport();
                break;
            case 'revenue-report':
                report = await generateRevenueReport();
                break;
            case 'payment-history':
                report = await generatePaymentHistoryReport();
                break;
            case 'document-completion':
                report = await generateDocumentCompletionReport();
                break;
        }

        // Display report
        reportTitle.textContent = report.title;
        reportDate.textContent = `Generated on ${new Date().toLocaleDateString()}`;
        reportData.innerHTML = report.content;
        reportPreview.style.display = 'block';

        reportContent.innerHTML = `
            <div class="card">
                <h3>Report Generated Successfully</h3>
                <p>Your ${report.title} has been generated. Use the export button to download as PDF.</p>
                <div class="report-preview">
                    <div class="report-header">
                        <h4 id="reportTitle">${report.title}</h4>
                        <p id="reportDate">Generated on ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div id="reportData">${report.content}</div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Report generation error:', error);
        reportContent.innerHTML = '<div class="error">Failed to generate report. Please try again.</div>';
    }
}

async function generateClientSummaryReport() {
    const clientData = clients; // Use localStorage data
    const totalClients = clientData.length;
    const activeClients = clientData.filter(c => c.status === 'active').length;

    return {
        title: 'Client Summary Report',
        content: `
            <div class="report-section">
                <h4>Client Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h5>Total Clients</h5>
                        <span class="stat-number">${totalClients}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Active Clients</h5>
                        <span class="stat-number">${activeClients}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Inactive Clients</h5>
                        <span class="stat-number">${totalClients - activeClients}</span>
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h4>Recent Clients</h4>
                <table class="report-table">
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Status</th><th>Created</th></tr>
                    </thead>
                    <tbody>
                        ${clientData.slice(0, 10).map(client => `
                            <tr>
                                <td>${client.name}</td>
                                <td>${client.email || 'N/A'}</td>
                                <td><span class="status-badge ${client.status}">${client.status}</span></td>
                                <td>${new Date(client.created_at).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    };
}

async function generateAppointmentTrendsReport() {
    const appointmentData = appointments; // Use localStorage data
    const last30Days = appointmentData.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return aptDate >= thirtyDaysAgo;
    });

    const completed = last30Days.filter(apt => apt.status === 'completed').length;
    const cancelled = last30Days.filter(apt => apt.status === 'cancelled').length;
    const scheduled = last30Days.filter(apt => apt.status === 'scheduled').length;

    return {
        title: 'Appointment Trends Report',
        content: `
            <div class="report-section">
                <h4>Last 30 Days Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h5>Total Appointments</h5>
                        <span class="stat-number">${last30Days.length}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Completed</h5>
                        <span class="stat-number">${completed}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Cancelled</h5>
                        <span class="stat-number">${cancelled}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Scheduled</h5>
                        <span class="stat-number">${scheduled}</span>
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h4>Completion Rate</h4>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${last30Days.length > 0 ? (completed / last30Days.length * 100) : 0}%"></div>
                </div>
                <p>${last30Days.length > 0 ? Math.round(completed / last30Days.length * 100) : 0}% completion rate</p>
            </div>
        `
    };
}

async function generateRevenueReport() {
    const invoiceData = invoices; // Use localStorage data
    const totalRevenue = invoiceData.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
    const paidInvoices = invoiceData.filter(inv => inv.status === 'paid');
    const pendingInvoices = invoiceData.filter(inv => inv.status === 'pending');
    const paidRevenue = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

    return {
        title: 'Revenue Report',
        content: `
            <div class="report-section">
                <h4>Revenue Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h5>Total Revenue</h5>
                        <span class="stat-number">$${totalRevenue.toFixed(2)}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Paid Revenue</h5>
                        <span class="stat-number">$${paidRevenue.toFixed(2)}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Pending Revenue</h5>
                        <span class="stat-number">$${(totalRevenue - paidRevenue).toFixed(2)}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Total Invoices</h5>
                        <span class="stat-number">${invoiceData.length}</span>
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h4>Invoice Status Breakdown</h4>
                <div class="status-breakdown">
                    <div class="status-item">
                        <span class="status-label">Paid:</span>
                        <span class="status-count">${paidInvoices.length}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Pending:</span>
                        <span class="status-count">${pendingInvoices.length}</span>
                    </div>
                </div>
            </div>
        `
    };
}

async function generatePaymentHistoryReport() {
    try {
        // Fetch payment history from API
        const response = await fetch('/api/payment-reports');
        const result = await response.json();

        if (!result.success) {
            throw new Error('Failed to fetch payment data');
        }

        const { transactions, summary, payment_method_breakdown } = result.data;

        return {
            title: 'Payment History Report',
            content: `
                <div class="report-section">
                    <h4>Payment Summary</h4>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h5>Total Revenue</h5>
                            <span class="stat-number">$${summary.total_revenue.toFixed(2)}</span>
                        </div>
                        <div class="stat-card">
                            <h5>Outstanding</h5>
                            <span class="stat-number">$${summary.outstanding.toFixed(2)}</span>
                        </div>
                        <div class="stat-card">
                            <h5>Refunds</h5>
                            <span class="stat-number" style="color: #dc3545;">-$${summary.refunds.toFixed(2)}</span>
                        </div>
                        <div class="stat-card">
                            <h5>Collection Rate</h5>
                            <span class="stat-number">${summary.collection_rate.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div class="report-section">
                    <h4>Payment Methods</h4>
                    <div class="payment-methods-breakdown">
                        ${payment_method_breakdown.map(method => `
                            <div class="payment-method-item" style="padding: 10px; border-bottom: 1px solid #e9ecef;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${method.brand ? method.brand.toUpperCase() : 'Unknown'}</strong>
                                        <span style="color: #6c757d; margin-left: 10px;">${method.type}</span>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-weight: 600;">$${parseFloat(method.total).toFixed(2)}</div>
                                        <div style="font-size: 12px; color: #6c757d;">${method.count} transactions</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="report-section">
                    <h4>Recent Transactions</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Client</th>
                                <th>Invoice</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.slice(0, 20).map(txn => `
                                <tr>
                                    <td>${new Date(txn.created_at).toLocaleDateString()}</td>
                                    <td>${txn.client_name || 'N/A'}</td>
                                    <td>${txn.invoice_number || 'N/A'}</td>
                                    <td><span class="badge badge-${txn.type}">${txn.type}</span></td>
                                    <td>${txn.type === 'refund' ? '-' : ''}$${parseFloat(txn.amount).toFixed(2)}</td>
                                    <td><span class="status-badge ${txn.status}">${txn.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `
        };
    } catch (error) {
        console.error('Payment history report error:', error);
        return {
            title: 'Payment History Report',
            content: `
                <div class="error">
                    <p>Unable to generate payment history report.</p>
                    <p>${error.message}</p>
                    <p style="margin-top: 20px;">Note: Payment history reports require database connection.</p>
                </div>
            `
        };
    }
}

async function generateDocumentCompletionReport() {
    const docData = assignedDocs; // Use localStorage data
    const totalDocs = docData.length;
    const completedDocs = docData.filter(doc => doc.status === 'completed').length;
    const pendingDocs = docData.filter(doc => doc.status === 'pending').length;

    return {
        title: 'Document Completion Report',
        content: `
            <div class="report-section">
                <h4>Document Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h5>Total Documents</h5>
                        <span class="stat-number">${totalDocs}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Completed</h5>
                        <span class="stat-number">${completedDocs}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Pending</h5>
                        <span class="stat-number">${pendingDocs}</span>
                    </div>
                    <div class="stat-card">
                        <h5>Completion Rate</h5>
                        <span class="stat-number">${totalDocs > 0 ? Math.round(completedDocs / totalDocs * 100) : 0}%</span>
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h4>Recent Document Activity</h4>
                <table class="report-table">
                    <thead>
                        <tr><th>Document</th><th>Client</th><th>Status</th><th>Assigned</th></tr>
                    </thead>
                    <tbody>
                        ${docData.slice(0, 10).map(doc => `
                            <tr>
                                <td>${doc.template_name}</td>
                                <td>${doc.client_name}</td>
                                <td><span class="status-badge ${doc.status}">${doc.status}</span></td>
                                <td>${new Date(doc.assigned_at).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    };
}

function exportReport() {
    const reportContent = document.querySelector('.report-preview');
    if (!reportContent) {
        showNotification('Please generate a report first', 'warning');
        return;
    }

    // Simple PDF export using browser print functionality
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Sessionably Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .report-header { text-align: center; margin-bottom: 30px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
                    .stat-card { border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 8px; }
                    .stat-number { font-size: 24px; font-weight: bold; color: #0F4C81; }
                    .report-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .report-table th, .report-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .report-table th { background-color: #f5f5f5; }
                    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                    .status-badge.completed { background-color: #d4edda; color: #155724; }
                    .status-badge.pending { background-color: #fff3cd; color: #856404; }
                    .status-badge.active { background-color: #d1ecf1; color: #0c5460; }
                </style>
            </head>
            <body>
                ${reportContent.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}
