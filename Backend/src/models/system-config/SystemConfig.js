const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema(
    {
        general: {
            siteName: {
                type: String,
                trim: true,
                default: '',
            },
            siteUrl: {
                type: String,
                trim: true,
                default: '',
            },
            timezone: {
                type: String,
                trim: true,
                default: 'UTC',
            },
            maintenanceMode: {
                type: Boolean,
                default: false,
            },
            autoBackup: {
                type: Boolean,
                default: true,
            },
        },

        email: {
            smtpHost: {
                type: String,
                trim: true,
                default: '',
            },
            smtpPort: {
                type: Number,
                default: 587,
            },
            smtpUsername: {
                type: String,
                trim: true,
                default: '',
            },
            smtpPassword: {
                type: String,
                default: '',
            },
            fromEmail: {
                type: String,
                trim: true,
                default: '',
            },
            fromName: {
                type: String,
                trim: true,
                default: 'SecureIT Support',
            },
            emailNotificationsEnabled: {
                type: Boolean,
                default: true,
            },
        },

        security: {
            sessionTimeoutMinutes: {
                type: Number,
                default: null,
                min: 5,
            },
            maxLoginAttempts: {
                type: Number,
                default: null,
                min: 1,
            },
            minimumPasswordLength: {
                type: Number,
                default: null,
                min: 6,
            },
            requireTwoFactorAuth: {
                type: Boolean,
                default: null,
            },
            allowedIpAddresses: [
                {
                    type: String,
                    trim: true,
                },
            ],
        },

        notifications: {
            newUserRegistration: {
                type: Boolean,
                default: true,
            },
            serviceRequestAlerts: {
                type: Boolean,
                default: true,
            },
            systemErrors: {
                type: Boolean,
                default: true,
            },
            securityAlerts: {
                type: Boolean,
                default: true,
            },
            subscriptionRenewals: {
                type: Boolean,
                default: true,
            },
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);