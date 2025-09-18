const { Sequelize, DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");

// Load our custom pg wrapper
const pgWrapper = require("./pg-wrapper");
const vercelDb = require("./vercel-db");

// Create Sequelize instance with proper SSL configuration for Render
let sequelize;

try {
  // Detect database provider
  const databaseUrl = process.env.DATABASE_URL;
  const isVercelProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const isSupabaseDatabase = databaseUrl && (databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com'));
  const isRenderDatabase = databaseUrl && databaseUrl.includes('render.com');

  if (isVercelProduction) {
    console.log(
      "🚀 Running in Vercel production environment, using optimized configuration"
    );
    sequelize = vercelDb.createVercelSequelize(databaseUrl);
  } else {
    console.log("🏠 Running in local/development environment");

    // Ensure pg package is available
    if (!pgWrapper.isAvailable()) {
      throw new Error(
        "PostgreSQL driver (pg) is required but not available. Please ensure pg package is installed."
      );
    }

    console.log("✅ pg package is available and ready to use");

    // Provider-specific SSL configurations
    let dialectOptions = {};

    if (isSupabaseDatabase) {
      console.log("🔗 Configuring for Supabase PostgreSQL");
      dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    } else if (isRenderDatabase) {
      console.log("🔗 Configuring for Render PostgreSQL");
      dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    } else {
      console.log("🔗 Configuring for local PostgreSQL");
      // No SSL required for local development
      dialectOptions = {};
    }

    sequelize = new Sequelize(databaseUrl, {
      dialect: "postgres",
      dialectOptions: {
        ...dialectOptions,
        // Additional connection options for stability
        keepAlive: true,
        keepAliveInitialDelayMillis: 0,
        statement_timeout: 60000, // 60 seconds
        query_timeout: 60000,
        connectionTimeoutMillis: 30000,
        idle_in_transaction_session_timeout: 30000,
      },
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      underscored: true, // Force snake_case for all columns globally
      pool: {
        max: isSupabaseDatabase || isRenderDatabase ? 8 : 3, // Reduced for stability
        min: 0,
        acquire: 60000, // Increased acquire timeout
        idle: 30000, // Increased idle timeout
        evict: 60000, // Connection eviction timeout
        handleDisconnects: true, // Handle unexpected disconnections
        validate: (client) => {
          // Validate connection before use
          return client && !client._ending;
        },
      },
      // Enhanced retry configuration
      retry: {
        max: 3,
        timeout: 30000,
        match: [
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/,
          /ConnectionError/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
        ]
      },
      // Provider-specific optimizations
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true, // Prevent pluralization issues
      },
      // Connection hooks for better error handling
      hooks: {
        beforeConnect: async (config) => {
          console.log('🔗 Establishing database connection...');
        },
        afterConnect: async (connection, config) => {
          console.log('✅ Database connection established');
        },
        beforeDisconnect: async (connection) => {
          console.log('🔌 Disconnecting from database...');
        },
        afterDisconnect: async (connection) => {
          console.log('❌ Database disconnected');
        },
      },
    });
  }
} catch (error) {
  console.error("Failed to create Sequelize instance:", error);
  throw error;
}

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

// Define Submission model
const Submission = sequelize.define(
  "Submission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tracking_code: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    nama: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nik: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    no_wa: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    jenis_layanan: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENGAJUAN_BARU", "DIPROSES", "SELESAI", "DITOLAK"),
      defaultValue: "PENGAJUAN_BARU",
      allowNull: false,
    },
  },
  {
    tableName: "submissions",
    timestamps: true, // Enable automatic timestamp columns
    createdAt: "created_at", // Map to database column name
    updatedAt: "updated_at", // Map to database column name
  }
);

// Define NotificationLog model
const NotificationLog = sequelize.define(
  "NotificationLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    submission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "submissions",
        key: "id",
      },
    },
    channel: {
      type: DataTypes.ENUM("WHATSAPP", "EMAIL"),
      allowNull: false,
    },
    send_status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED"),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: "notification_logs",
    timestamps: true, // Re-enabled for automatic timestamp columns
    createdAt: "created_at", // Map to database column name
    updatedAt: false, // Only track creation time
  }
);

// Define Admin model
const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
  },
  {
    tableName: "admins",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

const hashPassword = async (admin) => {
  if (!admin.changed("password")) {
    return;
  }

  const saltRounds = Number.isNaN(SALT_ROUNDS) ? 10 : SALT_ROUNDS;
  admin.password = await bcrypt.hash(admin.password, saltRounds);
};

Admin.addHook("beforeCreate", hashPassword);
Admin.addHook("beforeUpdate", hashPassword);

// Define relationships
Submission.hasMany(NotificationLog, { foreignKey: "submission_id" });
NotificationLog.belongsTo(Submission, { foreignKey: "submission_id" });

// Helper function to safely add timestamp columns to existing tables
const safelyAddTimestampColumns = async (queryInterface, tableName, hasUpdatedAt = true) => {
  try {
    const tableDefinition = await queryInterface.describeTable(tableName);

    // Handle created_at column
    if (!tableDefinition.created_at) {
      console.log(`📅 Adding created_at column to ${tableName} with safe migration for existing data`);

      try {
        // Step 1: Add the column as nullable with a default value
        await queryInterface.addColumn(tableName, "created_at", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });

        // Step 2: Update existing null values with current timestamp
        const [results] = await sequelize.query(
          `UPDATE "${tableName}" SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;`
        );
        console.log(`✅ Updated ${results?.rowCount || 0} rows with created_at timestamps`);

        // Step 3: Now make the column NOT NULL
        await queryInterface.changeColumn(tableName, "created_at", {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });
        console.log(`✅ Successfully added created_at column to ${tableName}`);

      } catch (columnError) {
        // Handle specific errors for column creation
        if (columnError?.original?.code === "42701") {
          console.log(`ℹ️ created_at column already exists in ${tableName}, skipping creation`);
        } else if (columnError?.original?.code === "23502") {
          console.log(`⚠️ NOT NULL constraint issue for created_at in ${tableName}, attempting fix...`);

          // Try to fix existing null values and then add constraint
          await sequelize.query(
            `UPDATE "${tableName}" SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;`
          );

          // Retry making it NOT NULL
          await queryInterface.changeColumn(tableName, "created_at", {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          });
        } else {
          throw columnError;
        }
      }
    } else {
      console.log(`✅ created_at column already exists in ${tableName}`);
    }

    // Handle updated_at column (only if the model uses it)
    if (hasUpdatedAt && !tableDefinition.updated_at) {
      console.log(`📅 Adding updated_at column to ${tableName} with safe migration for existing data`);

      try {
        // Step 1: Add the column as nullable with a default value
        await queryInterface.addColumn(tableName, "updated_at", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });

        // Step 2: Update existing null values with current timestamp
        const [results] = await sequelize.query(
          `UPDATE "${tableName}" SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`
        );
        console.log(`✅ Updated ${results?.rowCount || 0} rows with updated_at timestamps`);

        // Step 3: Now make the column NOT NULL
        await queryInterface.changeColumn(tableName, "updated_at", {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });
        console.log(`✅ Successfully added updated_at column to ${tableName}`);

      } catch (columnError) {
        // Handle specific errors for column creation
        if (columnError?.original?.code === "42701") {
          console.log(`ℹ️ updated_at column already exists in ${tableName}, skipping creation`);
        } else if (columnError?.original?.code === "23502") {
          console.log(`⚠️ NOT NULL constraint issue for updated_at in ${tableName}, attempting fix...`);

          // Try to fix existing null values and then add constraint
          await sequelize.query(
            `UPDATE "${tableName}" SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`
          );

          // Retry making it NOT NULL
          await queryInterface.changeColumn(tableName, "updated_at", {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          });
        } else {
          throw columnError;
        }
      }
    } else if (hasUpdatedAt) {
      console.log(`✅ updated_at column already exists in ${tableName}`);
    }

  } catch (tableError) {
    if (tableError?.original?.code === "42P01") {
      console.log(`ℹ️ ${tableName} table does not exist yet, skipping timestamp column checks`);
    } else {
      console.warn(`⚠️ Could not ensure timestamp columns on ${tableName} table:`, tableError.message);
      // Don't throw here, let the sync process handle table creation
    }
  }
};

// Detect database provider for provider-specific optimizations
const detectDatabaseProvider = (databaseUrl) => {
  if (!databaseUrl) return 'unknown';

  if (databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com')) {
    return 'supabase';
  } else if (databaseUrl.includes('render.com')) {
    return 'render';
  } else if (databaseUrl.includes('vercel')) {
    return 'vercel';
  }

  return 'unknown';
};

// Initialize database with enhanced retry logic
const initializeDatabase = async (retries = 5) => {
  try {
    console.log("🔄 Attempting to connect to database...");

    // Add connection event listeners for better monitoring
    sequelize.connectionManager.on('connection', () => {
      console.log('📡 New database connection established');
    });

    sequelize.connectionManager.on('disconnect', () => {
      console.log('📡 Database connection lost');
    });

    // Test the connection with a timeout
    const connectionTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000);
    });

    await Promise.race([
      sequelize.authenticate(),
      connectionTimeout
    ]);

    console.log("✅ Database connection established successfully.");

    const queryInterface = sequelize.getQueryInterface();
    const databaseProvider = detectDatabaseProvider(process.env.DATABASE_URL);
    console.log(`🔍 Detected database provider: ${databaseProvider}`);

    // Test connection stability before proceeding
    console.log("🧪 Testing connection stability...");
    await sequelize.query('SELECT 1 as test');

    // Safely add timestamp columns to existing tables before sync
    console.log("📋 Checking table schema...");
    await safelyAddTimestampColumns(queryInterface, "submissions", true);
    await safelyAddTimestampColumns(queryInterface, "notification_logs", false); // NotificationLog only has created_at
    await safelyAddTimestampColumns(queryInterface, "admins", true);

    // Only sync in development, not in production
    if (process.env.NODE_ENV === "development" || process.env.VERCEL !== "1") {
      console.log(
        "🔧 Development environment detected, synchronizing database models..."
      );

      // Use a safer sync approach that doesn't aggressively alter existing data
      await sequelize.sync({
        alter: {
          drop: false, // Never drop columns
        }
      });
      console.log("✅ Database models synchronized.");
    } else {
      console.log(
        "🏭 Production environment detected, skipping database sync to prevent schema conflicts."
      );
      console.log(
        "📋 Database tables should already exist and be properly configured."
      );
    }

    // Final connection test
    await sequelize.query('SELECT 1 as final_test');
    console.log("🎉 Database initialization completed successfully!");

  } catch (error) {
    console.error("❌ Database connection failed:", error.name, error.message);

    // More specific error handling
    if (error.name === 'SequelizeConnectionError' ||
        error.name === 'ConnectionError' ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('Connection terminated')) {

      if (retries > 0) {
        const waitTime = (6 - retries) * 2000; // Progressive backoff
        console.log(`⏳ Retrying connection in ${waitTime/1000}s... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Try to close existing connections before retry
        try {
          await sequelize.close();
        } catch (closeError) {
          console.log("⚠️ Error closing existing connections:", closeError.message);
        }

        return initializeDatabase(retries - 1);
      }
    }

    console.error("💀 Max retries reached or unrecoverable error. Database initialization failed.");

    // In development, don't exit the process - just log the error
    if (process.env.NODE_ENV === "development") {
      console.error("🚧 Development mode: Continuing without database connection.");
      console.error("🔧 Please check your DATABASE_URL and database server status.");
      return;
    }

    // In production, exit the process
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  Submission,
  NotificationLog,
  Admin,
  initializeDatabase,
};
