import mongoose from "mongoose";
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const LoginSchema = new mongoose.Schema({

  email: {
    type: String, required: true, trim: true, lowercase: true,
    validate: {
      validator: function(val) {
        return emailRegex.test(val)
      },
      message: props => `${props.value} is not a valid email`
    }

  },
  is_first_login: {
    type: Boolean, default: true
  }
  ,
  refresh_token_hash: {
    type: String,
    required: true,
    select: false
  },
  session_id: {
    type: String,
    required: true
  },
  user_id: {
    type: String, required: true
  },
  created_at: {
    type: Date, required: true, default: Date.now
  }
  ,
  expired_at: {
    type: Date, required: true
  }

},{timestamps:true})

LoginSchema.index(
  { session_id: 1 },
  {
    unique: true,
    partialFilterExpression: { session_id: { $type: 'string' } },
    name: 'unique_refresh_session_id'
  }
)
LoginSchema.index(
  { refresh_token_hash: 1 },
  {
    unique: true,
    partialFilterExpression: { refresh_token_hash: { $type: 'string' } },
    name: 'unique_refresh_token_hash'
  }
)
LoginSchema.index({ expired_at: 1 }, { expireAfterSeconds: 0, name: 'expire_refresh_sessions' })

export default mongoose.model('LoginCredentials', LoginSchema)
