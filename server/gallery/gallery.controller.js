const express = require('express');
const router = express.Router();
const authenticate = require('../_middleware/authenticate');
const GalleryItem = require('../models/gallery-item.model');
const db = require('../_helpers/db');

// List current user's gallery
router.get('/me', authenticate(), async (req, res, next) => {
    try {
        const items = await GalleryItem.find({ accountId: req.user.id })
            .sort({ createdAt: -1 })
            .lean();
        res.json(items.map(d => ({ ...d, id: d._id?.toString(), _id: undefined })));
    } catch (error) {
        next(error);
    }
});

// Get/update gallery settings (must be before /:accountId)
router.get('/settings/me', authenticate(), async (req, res, next) => {
    try {
        const account = await db.Account.findById(req.user.id).select('galleryVisibility gallerySharedWith').lean();
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json({
            galleryVisibility: account.galleryVisibility || 'private',
            gallerySharedWith: account.gallerySharedWith || []
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/settings/me', authenticate(), async (req, res, next) => {
    try {
        const { galleryVisibility, gallerySharedWith } = req.body;
        const update = {};
        if (galleryVisibility !== undefined) {
            if (galleryVisibility !== 'private') {
                return res.status(400).json({ message: 'Gallery visibility can only be private (only me or specific members)' });
            }
            update.galleryVisibility = 'private';
        }
        if (gallerySharedWith !== undefined) {
            update.gallerySharedWith = Array.isArray(gallerySharedWith) ? gallerySharedWith : [];
        }
        const account = await db.Account.findByIdAndUpdate(
            req.user.id,
            { $set: update },
            { new: true }
        ).select('galleryVisibility gallerySharedWith');
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json({
            galleryVisibility: account.galleryVisibility,
            gallerySharedWith: account.gallerySharedWith || []
        });
    } catch (error) {
        next(error);
    }
});

// List accounts that have shared their gallery with the current user (for "Shared with me" in modal)
router.get('/shared-with-me', authenticate(), async (req, res, next) => {
    try {
        const viewerId = req.user.id;
        const accounts = await db.Account.find({
            gallerySharedWith: viewerId
        }).select('firstName lastName').lean();
        const list = (accounts || []).map(a => ({
            id: (a._id && a._id.toString()) || '',
            firstName: a.firstName || '',
            lastName: a.lastName || ''
        }));
        res.json(list);
    } catch (error) {
        next(error);
    }
});

// Total number of items in galleries shared with the current user (for "Gallery (n) [m]" label)
router.get('/shared-with-me/total-items', authenticate(), async (req, res, next) => {
    try {
        const viewerId = req.user.id;
        const accounts = await db.Account.find({
            gallerySharedWith: viewerId
        }).select('_id').lean();
        const accountIds = (accounts || []).map(a => a._id);
        if (accountIds.length === 0) {
            return res.json({ totalItems: 0 });
        }
        const totalItems = await GalleryItem.countDocuments({
            accountId: { $in: accountIds },
            $or: [
                { shareMode: 'all-shared' },
                { shareMode: { $exists: false } },
                { shareMode: null },
                { shareMode: 'specific', sharedWith: viewerId }
            ]
        });
        res.json({ totalItems: totalItems || 0 });
    } catch (error) {
        next(error);
    }
});

// List gallery for an account (respects visibility)
router.get('/:accountId', authenticate(), async (req, res, next) => {
    try {
        const { accountId } = req.params;
        const viewerId = req.user.id;

        if (accountId === viewerId) {
            const items = await GalleryItem.find({ accountId }).sort({ createdAt: -1 }).lean();
            return res.json(items);
        }

        const account = await db.Account.findById(accountId).select('galleryVisibility gallerySharedWith').lean();
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const sharedWith = account.gallerySharedWith || [];
        const canView = Array.isArray(sharedWith) && sharedWith.some(id => id.toString() === viewerId);

        if (!canView) {
            return res.status(403).json({ message: 'You do not have permission to view this gallery' });
        }

        const items = await GalleryItem.find({
            accountId,
            $or: [
                { shareMode: 'all-shared' },
                { shareMode: { $exists: false } },
                { shareMode: null },
                { shareMode: 'specific', sharedWith: viewerId }
            ]
        }).sort({ createdAt: -1 }).lean();
        res.json(items.map(d => ({ ...d, id: d._id?.toString(), _id: undefined })));
    } catch (error) {
        next(error);
    }
});

// Create gallery item (after client uploads file and gets URL)
router.post('/', authenticate(), async (req, res, next) => {
    try {
        const { url, type, caption, thumbnailUrl } = req.body;
        if (!url || !type) {
            return res.status(400).json({ message: 'url and type are required' });
        }
        if (!['image', 'video'].includes(type)) {
            return res.status(400).json({ message: 'type must be image or video' });
        }
        const item = await GalleryItem.create({
            accountId: req.user.id,
            url,
            type,
            caption: caption || '',
            thumbnailUrl: thumbnailUrl || null,
            shareMode: 'all-shared',
            sharedWith: []
        });
        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
});


// Update item-level sharing (owner only)
router.patch('/:id', authenticate(), async (req, res, next) => {
    try {
        const item = await GalleryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Gallery item not found' });
        }
        if (item.accountId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'You can only update your own gallery items' });
        }

        const update = {};
        if (req.body.shareMode !== undefined) {
            if (!['all-shared', 'specific'].includes(req.body.shareMode)) {
                return res.status(400).json({ message: 'shareMode must be all-shared or specific' });
            }
            update.shareMode = req.body.shareMode;
        }
        if (req.body.sharedWith !== undefined) {
            update.sharedWith = Array.isArray(req.body.sharedWith) ? req.body.sharedWith : [];
        }
        if (update.shareMode === 'all-shared') {
            update.sharedWith = [];
        }

        const updated = await GalleryItem.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        ).lean();

        res.json({ ...updated, id: updated?._id?.toString(), _id: undefined });
    } catch (error) {
        next(error);
    }
});

// Delete gallery item (owner only)
router.delete('/:id', authenticate(), async (req, res, next) => {
    try {
        const item = await GalleryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Gallery item not found' });
        }
        if (item.accountId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'You can only delete your own gallery items' });
        }
        await GalleryItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Gallery item deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
