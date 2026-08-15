import mongoose from 'mongoose';

import { PUBLIC_KEY_HEX_LENGTH } from '../utils/pqcParams';

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    // `unique` is an index option, not a validator, so it takes a plain
    // boolean. Duplicate inserts surface as MongoDB error code 11000, which
    // the register route translates into a 409.
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
  },
  pqcPublicKey: {
    type: String,
    required: true,
    // Length is enforced here as well as in the route so that no code path can
    // store a key that would overflow a peer's fixed-size WASM allocation.
    validate: {
      validator: (value) => new RegExp(`^[0-9a-fA-F]{${PUBLIC_KEY_HEX_LENGTH}}$`).test(value),
      message: `pqcPublicKey must be ${PUBLIC_KEY_HEX_LENGTH} hex characters`,
    },
  },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
