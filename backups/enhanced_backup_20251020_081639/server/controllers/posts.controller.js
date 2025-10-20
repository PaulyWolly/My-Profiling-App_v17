const express = require('express');
const router = express.Router();
const Post = require('../users/post.model');
const websocketService = require('../services/websocket.service');
const { isSuperAdmin } = require('../middleware/auth');

// Create a new post
router.post('/', async (req, res) => {
  try {
    const { sender, recipient, content } = req.body;
    const post = new Post({ sender, recipient, content });
    await post.save();
    // Populate sender and recipient for richer event data
    const populatedPost = await Post.findById(post._id)
      .populate('sender', 'firstName lastName profileImage')
      .populate('recipient', 'firstName lastName profileImage');
    // Emit new_post event to recipient
    websocketService.emitNewPost(recipient, populatedPost);
    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all posts for a user (sent or received)
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const posts = await Post.find({
      $or: [{ sender: userId }, { recipient: userId }]
    })
      .populate('sender', 'firstName lastName profileImage')
      .populate('recipient', 'firstName lastName profileImage')
      .populate('replies.sender', 'firstName lastName profileImage')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add a reply to a post
router.post('/:id/reply', async (req, res) => {
  try {
    const { sender, content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.replies.push({ sender, content });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a post (Super-Admin only)
router.delete('/:id', isSuperAdmin, async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Increment likes for a post
router.post('/:id/like', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Increment shares for a post
router.post('/:id/share', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { shares: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ shares: post.shares });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; 