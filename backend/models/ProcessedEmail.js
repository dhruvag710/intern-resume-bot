const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProcessedEmail = sequelize.define('ProcessedEmail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  gmail_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  from: {
    type: DataTypes.STRING,
    allowNull: true
  },
  classification: {
    type: DataTypes.ENUM('Promising', 'Not Promising'),
    allowNull: false
  },
  has_attachments: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  processed_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  gmail_label_id: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['gmail_id']
    },
    {
      fields: ['classification']
    },
    {
      fields: ['processed_at']
    }
  ]
});

module.exports = ProcessedEmail; 