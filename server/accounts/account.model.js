const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    plainPassword: { type: String }, // Store plain text password for Super-Admin access
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    acceptTerms: Boolean,
    role: { type: String, required: true },
    verificationToken: String,
    verified: Date,
    resetToken: {
        token: String,
        expires: Date
    },
    passwordReset: Date,
    created: { type: Date, default: Date.now },
    updated: Date,
    profileImage: String,

    // Profile template selection
    profileTemplateType: { type: String, default: 'STANDARD' },

    // Personal & Professional Details
    position: String,
    company: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    phone: String,
    mobile: String,
    bio: String,

    // Social Media Links
    website: String,
    github: String,
    twitter: String,
    instagram: String,
    facebook: String,
    linkedin: { type: String },

    // Social Media Stats
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

    // Professional Skills
    skills: [{ type: String }],

    // Follower Images for Social Media template
    followerImages: [{
        id: String,
        name: String,
        title: String,
        imageUrl: String,
        path: String
    }],

    // Gallery visibility: who can see this account's gallery
    galleryVisibility: { type: String, enum: ['private'], default: 'private' },
    gallerySharedWith: [{ type: Schema.Types.ObjectId, ref: 'Account' }],

    // Auth0 integration fields
    auth0Id: String,
    authProvider: String
});

schema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

// Add method to check if account owns a refresh token
schema.methods.ownsToken = function(token) {
    return this.model('RefreshToken').findOne({ token, account: this._id })
        .then(refreshToken => !!refreshToken);
};

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // ensure id is always present for API consumers (e.g. Gallery tab visibility)
        if (ret._id) ret.id = ret._id.toString();
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
    }
});

module.exports = mongoose.model('Account', schema);
