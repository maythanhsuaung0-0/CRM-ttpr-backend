// register info for all users
// name, email, id, role(student or staff), locked, verified

import mongoose from "mongoose";
const phoneRegex = /^(?:(?:\+1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?)$/
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const removePassword = (_doc, value) => {
  delete value.password
  return value
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, minLength: 3 },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(val) {
        return emailRegex.test(val)
      },
      message: props => `${props.value} is not a valid email`
    }
  },
  id: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(val) {
        return !isNaN(val) && val.length === 8
      },
      message: 'id must be number and must have 8 digits'
    }
  },
  phone: {
    type: String,
    validate: {
      validator: function(val) {
        return phoneRegex.test(val)},
      message: 'Invalid phone number'
    }

  },

  password: {
    type: String,
    required: true,
    select: false,
    message: 'password must be longer than 8 characters and must include a digit, a letter, a special character'
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    required: true
  },
  locked: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { transform: removePassword },
  toObject: { transform: removePassword }
})

UserSchema.index(
  { email: 1 },
  { unique: true, name: 'unique_user_email', collation: { locale: 'en', strength: 2 } }
)
UserSchema.index({ id: 1 }, { unique: true, name: 'unique_user_id' })

export default mongoose.model('User', UserSchema)
