const categoryService = require('../services/categoryService');

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const category = await categoryService.createCategory(name, description);
    res.status(201).json(category);
  } catch (error) {
    next(error)
    // res.status(400).json({ message: error.message });
  }
};

const getCategories = async (req, res,next) => {
  try {
    const categories = await categoryService.getCategories();
    res.status(200).json(categories);
  } catch (error) {
   next(error)
    // res.status(500).json({ message: error.message });
  }
};
// backend/controllers/categoryController.js

const updateCategory = async (req, res,next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body; // Explicitly pull only editable fields

    const updatedCategory = await categoryService.updateCategory(id, { name, description });
    res.status(200).json(updatedCategory);
  } 
  catch (error) {

    next(error)
    // console.error('Update Category Controller Error:', error);
    // res.status(400).json({ message: error.message || 'Failed to update category' });

  }



};
// DELETE /api/categories/:id
const deleteCategory = async (req, res,next) => {
try {
    const { id } = req.params;

    // CHANGED: Calling service function instead of direct DB queries
    const response = await categoryService.deleteCategory(id);

    res.status(200).json(response);
  }catch (error) {
    next(error)
    // res.status(500).json({ message: error.message });
  }
};



module.exports = { createCategory, getCategories, updateCategory, deleteCategory};