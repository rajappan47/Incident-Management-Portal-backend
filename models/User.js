// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Primary Role in the system
    role: {
      type: String,
      enum: ['Admin', 'Support Agent', 'End User', 'SubUser'],
      default: 'End User',
    },

    // ------------------ SUB-USER FIELDS ------------------ //
    
    // Flag to easily check if this account is a Sub-User
    isSubUser: {
      type: Boolean,
      default: false,
    },

    // 🔑 Parent User Reference (Points to the End User or Support Agent who created this Sub-User)
    parentUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Specifies if this sub-user is under a Support Agent or an End User
    subUserType: {
      type: String,
      enum: ['SUPPORT_SUBUSER', 'END_USER_SUBUSER', null],
      default: null,
    },

    // 🛡️ Postgres-style Granted Permissions Array (e.g., ['tickets:view_active', 'tickets:create'])
    permissions: [
      {
        type: String,
      },
    ],

    // ------------------ EXISTING FIELDS ------------------ //

    // The Team the agent belongs to
    team: {
      type: String, // e.g., 'IT Infrastructure', 'Application Support'
      required: function () {
        return this.role === 'Support Agent';
      },
    },

    // Array of specific Categories this agent is qualified/assigned to handle
    categories: [
      {
        type: String, // e.g., ['Network', 'VPN', 'Firewall']
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);