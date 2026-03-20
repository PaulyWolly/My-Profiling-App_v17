const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const authenticate = require('../_middleware/authenticate');
const GalleryItem = require('../models/gallery-item.model');
const db = require('../_helpers/db');

/**
 * Aggregation $match does NOT use Mongoose query casting. req.user.id is a string;
 * sharedWith in DB is ObjectId[], so we must compare with ObjectId or matches fail.
 */
function toObjectId(id) {
    if (id == null) return null;
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

/** Match viewer id against sharedWith (ObjectId or string stored in DB). */
function sharedWithContainsViewer(viewerId) {
    const oid = toObjectId(viewerId);
    const s = String(viewerId);
    if (oid) {
        return { $in: [oid, s] };
    }
    return s;
}

/**
 * Items a viewer may see on someone else's gallery (they already passed gallerySharedWith check).
 * - Legacy all-shared rows
 * - shareWithAllGalleryMembers: everyone on owner's gallery list (see PATCH all-shared)
 * - specific + viewer in sharedWith (ObjectId-safe)
 */
function viewerVisibleItemsQuery(viewerId) {
    const or = [
        { shareMode: 'all-shared' },
        { shareMode: 'specific', shareWithAllGalleryMembers: true },
        { shareMode: 'specific', sharedWith: sharedWithContainsViewer(viewerId) }
    ];
    return { $or: or };
}

/** $match stage for aggregation (same logic; aggregation does not cast strings to ObjectId). */
function viewerVisibleItemsMatch(viewerId) {
    const oid = toObjectId(viewerId);
    const s = String(viewerId);
    const or = [
        { shareMode: 'all-shared' },
        { shareMode: 'specific', shareWithAllGalleryMembers: true }
    ];
    if (oid) {
        or.push({ shareMode: 'specific', sharedWith: oid });
        or.push({ shareMode: 'specific', sharedWith: s });
    }
    return { $match: { $or: or } };
}

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

// List accounts that have explicitly shared at least one gallery item with the current user
router.get('/shared-with-me', authenticate(), async (req, res, next) => {
    try {
        const viewerId = req.user.id;
        const ownerIdGroups = await GalleryItem.aggregate([
            viewerVisibleItemsMatch(viewerId),
            { $group: { _id: '$accountId' } }
        ]);
        const ownerIds = (ownerIdGroups || []).map((g) => g._id).filter(Boolean);
        if (ownerIds.length === 0) {
            return res.json([]);
        }
        const accounts = await db.Account.find({
            _id: { $in: ownerIds },
            gallerySharedWith: viewerId
        })
            .select('firstName lastName')
            .lean();
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
        // Count items visible to this viewer (specific + in sharedWith, or legacy all-shared)
        const totalItems = await GalleryItem.countDocuments({
            accountId: { $in: accountIds },
            ...viewerVisibleItemsQuery(viewerId)
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

        const viewerStr = String(viewerId);
        const galleryIdSet = new Set(sharedWith.map((id) => id.toString()));

        const candidates = await GalleryItem.find({
            accountId,
            shareMode: { $in: ['specific', 'all-shared'] }
        })
            .sort({ createdAt: -1 })
            .lean();

        const items = (candidates || []).filter((item) => {
            if (item.shareMode === 'all-shared') return true;
            if (item.shareWithAllGalleryMembers) return true;
            const sw = (item.sharedWith || []).map((x) => x.toString());
            if (sw.includes(viewerStr)) return true;
            // Legacy "all gallery members" saved as specific + id list equal to current gallery members
            if (
                galleryIdSet.size > 0 &&
                sw.length === galleryIdSet.size &&
                sw.every((id) => galleryIdSet.has(id))
            ) {
                return true;
            }
            return false;
        });

        res.json(items.map((d) => ({ ...d, id: d._id?.toString(), _id: undefined })));
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
            shareMode: 'owner-only',
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
            const mode = req.body.shareMode;
            if (!['owner-only', 'all-shared', 'specific'].includes(mode)) {
                return res.status(400).json({ message: 'shareMode must be owner-only, all-shared, or specific' });
            }
            if (mode === 'owner-only') {
                update.shareMode = 'owner-only';
                update.sharedWith = [];
                update.shareWithAllGalleryMembers = false;
            } else if (mode === 'all-shared') {
                // UI "all gallery members" → flag + snapshot of ids (for owner UI); viewers use the flag
                const account = await db.Account.findById(req.user.id).select('gallerySharedWith').lean();
                update.shareMode = 'specific';
                update.sharedWith = (account?.gallerySharedWith || []).map((id) => id.toString());
                update.shareWithAllGalleryMembers = true;
            } else {
                update.shareMode = 'specific';
                update.sharedWith = req.body.sharedWith !== undefined
                    ? (Array.isArray(req.body.sharedWith) ? req.body.sharedWith : [])
                    : (item.sharedWith || []).map((id) => id.toString());
                update.shareWithAllGalleryMembers = false;
            }
        } else if (req.body.sharedWith !== undefined) {
            update.shareMode = 'specific';
            update.sharedWith = Array.isArray(req.body.sharedWith) ? req.body.sharedWith : [];
            update.shareWithAllGalleryMembers = false;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: 'Nothing to update' });
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
