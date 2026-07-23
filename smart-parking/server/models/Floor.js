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

// totalSlots is derived from slots.length rather than a separately stored
// field kept in sync by a pre('save') hook -- that hook never ran for
// writes that bypass document middleware (e.g. insertMany, findOneAndUpdate),
// so a stored counter could silently drift from the real slot count.
floorSchema.virtual('totalSlots').get(function () {
  return (this.slots || []).length;
});

module.exports = mongoose.model('Floor', floorSchema);
