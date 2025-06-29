'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('Starting database cleanup...');

      // Drop old tables if they exist
      const tablesToDrop = ['Emails', 'Todos', 'Users'];
      
      for (const table of tablesToDrop) {
        try {
          await queryInterface.dropTable(table);
          console.log(`Dropped table: ${table}`);
        } catch (error) {
          if (error.message.includes('doesn\'t exist')) {
            console.log(`Table ${table} doesn't exist, skipping...`);
          } else {
            console.error(`Error dropping table ${table}:`, error);
          }
        }
      }

      // Create new ProcessedEmails table
      await queryInterface.createTable('ProcessedEmails', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        gmail_id: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        subject: {
          type: Sequelize.STRING,
          allowNull: true
        },
        from: {
          type: Sequelize.STRING,
          allowNull: true
        },
        classification: {
          type: Sequelize.ENUM('Promising', 'Not Promising'),
          allowNull: false
        },
        has_attachments: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        processed_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        gmail_label_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });

      // Add indexes
      await queryInterface.addIndex('ProcessedEmails', ['gmail_id'], {
        unique: true,
        name: 'processed_emails_gmail_id_unique'
      });

      await queryInterface.addIndex('ProcessedEmails', ['classification'], {
        name: 'processed_emails_classification_index'
      });

      await queryInterface.addIndex('ProcessedEmails', ['processed_at'], {
        name: 'processed_emails_processed_at_index'
      });

      console.log('Database cleanup completed successfully');
    } catch (error) {
      console.error('Database cleanup failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('Rolling back database cleanup...');

      // Drop the new table
      await queryInterface.dropTable('ProcessedEmails');
      console.log('Dropped ProcessedEmails table');

      // Note: We don't recreate the old tables in rollback as they were complex
      // and would require recreating all the old models and relationships
      console.log('Rollback completed (old tables not recreated)');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}; 