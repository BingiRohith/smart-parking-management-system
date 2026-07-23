const mongoose = require('mongoose');
const slotSchema = new mongoose.Schema(
  {
    slotNumber: {
      type: String,
      required: true,
      // e.g., "A1", "A2", "B1", etc.
    },
    row: {
      type: String,
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied'],
      default: 'available',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true }
);
const floorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Floor name is required'],
      trim: true,
      unique: true,
      // e.g., "Ground Floor", "-1 Floor", "-2 Floor"
    },
    level: {
      type: Number,
      required: true,
      unique: true,
      // 0 = Ground, -1, -2, 1, 2 etc.
    },
    totalSlots: {
      type: Number,
      required: true,
      default: 0,
    },
    slots: [slotSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      // Lower number = displayed first
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: count available slots dynamically
floorSchema.virtual('availableCount').get(function () {
  const slots = this.slots || [];
  return slots.filter((s) => s.status === 'available').length;
});

floorSchema.virtual('occupiedCount').get(function () {
  const slots = this.slots || [];
  return slots.filter((s) => s.status === 'occupied').length;
});

// Keep totalSlots in sync when slots array changes
floorSchema.pre('save', function () {
  this.totalSlots = (this.slots || []).length;
});

module.exports = mongoose.model('Floor', floorSchema);
