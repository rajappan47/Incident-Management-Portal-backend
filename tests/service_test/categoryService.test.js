const mongoose = require('mongoose');
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require('../../services/categoryService');
const Category = require('../../models/Category');

// Mocks
jest.mock('../../models/Category');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
}));

describe('categoryService Test Suite', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // CREATE CATEGORY
  // ==========================================
  describe('createCategory', () => {
    test('should throw 400 error if category name is missing', async () => {
      await expect(createCategory('', 'Hardware issues')).rejects.toMatchObject({
        message: 'Category name is required',
        statusCode: 400,
      });
    });

    test('should throw 400 error if category already exists', async () => {
      Category.findOne.mockResolvedValue({ _id: 'cat_123', name: 'Hardware' });

      await expect(createCategory('Hardware', 'Hardware issues')).rejects.toMatchObject({
        message: 'Category already exists',
        statusCode: 400,
      });

      expect(Category.findOne).toHaveBeenCalledWith({ name: 'Hardware' });
    });

    test('should create a new category successfully', async () => {
      Category.findOne.mockResolvedValue(null);
      const fakeCategory = {
        _id: 'cat_123',
        name: 'Hardware',
        description: 'Hardware issues',
      };
      Category.create.mockResolvedValue(fakeCategory);

      const result = await createCategory('Hardware', 'Hardware issues');

      expect(Category.create).toHaveBeenCalledWith({
        name: 'Hardware',
        description: 'Hardware issues',
      });
      expect(result).toEqual(fakeCategory);
    });
  });

  // ==========================================
  // GET CATEGORIES
  // ==========================================
  describe('getCategories', () => {
    test('should return all active categories', async () => {
      const fakeCategories = [
        { _id: 'cat_1', name: 'Hardware', active: true },
        { _id: 'cat_2', name: 'Software', active: true },
      ];
      Category.find.mockResolvedValue(fakeCategories);

      const result = await getCategories();

      expect(Category.find).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual(fakeCategories);
    });
  });

  // ==========================================
  // UPDATE CATEGORY
  // ==========================================
  describe('updateCategory', () => {
    test('should throw 400 error for invalid category ID format', async () => {
      await expect(
        updateCategory('invalid_id', { name: 'Updated' })
      ).rejects.toMatchObject({
        message: 'Invalid Category ID format',
        statusCode: 400,
      });
    });

    test('should throw 404 error if category is not found', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      Category.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        updateCategory(validId, { name: 'Updated', description: 'New Desc' })
      ).rejects.toMatchObject({
        message: 'Category not found',
        statusCode: 404,
      });
    });

    test('should update category successfully', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const updatedData = { _id: validId, name: 'Updated Hardware', description: 'New Desc' };
      
      Category.findByIdAndUpdate.mockResolvedValue(updatedData);

      const result = await updateCategory(validId, {
        name: 'Updated Hardware',
        description: 'New Desc',
      });

      expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        { name: 'Updated Hardware', description: 'New Desc' },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedData);
    });
  });

  // ==========================================
  // DELETE CATEGORY
  // ==========================================
  describe('deleteCategory', () => {
    test('should throw 400 error for invalid category ID format', async () => {
      await expect(deleteCategory('invalid_id')).rejects.toMatchObject({
        message: 'Invalid Category ID format',
        statusCode: 400,
      });
    });

    test('should throw 404 error if category to delete is not found', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      Category.findByIdAndDelete.mockResolvedValue(null);

      await expect(deleteCategory(validId)).rejects.toMatchObject({
        message: 'Category not found',
        statusCode: 404,
      });
    });

    test('should delete category successfully', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      Category.findByIdAndDelete.mockResolvedValue({ _id: validId });

      const result = await deleteCategory(validId);

      expect(Category.findByIdAndDelete).toHaveBeenCalledWith(validId);
      expect(result).toEqual({ message: 'Category removed successfully' });
    });
  });
});