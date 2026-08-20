const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require('../../controllers/categoryController');
const categoryService = require('../../services/categoryService');

// Mock categoryService
jest.mock('../../services/categoryService');

describe('categoryController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // --- 1. createCategory ---
  describe('createCategory', () => {
    test('should return 201 and created category object', async () => {
      const mockCategory = {
        _id: 'cat_1',
        name: 'Hardware',
        description: 'Hardware related issues',
      };

      req.body = {
        name: 'Hardware',
        description: 'Hardware related issues',
      };

      categoryService.createCategory.mockResolvedValue(mockCategory);

      await createCategory(req, res, next);

      expect(categoryService.createCategory).toHaveBeenCalledWith(
        'Hardware',
        'Hardware related issues'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCategory);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when creation fails', async () => {
      req.body = { name: 'Hardware', description: 'Hardware issues' };
      const mockError = new Error('Category name already exists');

      categoryService.createCategory.mockRejectedValue(mockError);

      await createCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 2. getCategories ---
  describe('getCategories', () => {
    test('should return 200 and list of categories', async () => {
      const mockCategories = [
        { _id: 'cat_1', name: 'Hardware', description: 'Hardware issues' },
        { _id: 'cat_2', name: 'Software', description: 'Software issues' },
      ];

      categoryService.getCategories.mockResolvedValue(mockCategories);

      await getCategories(req, res, next);

      expect(categoryService.getCategories).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCategories);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when fetch fails', async () => {
      const mockError = new Error('Database connection failed');
      categoryService.getCategories.mockRejectedValue(mockError);

      await getCategories(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 3. updateCategory ---
  describe('updateCategory', () => {
    test('should return 200 and updated category object', async () => {
      const mockUpdatedCategory = {
        _id: 'cat_1',
        name: 'Updated Hardware',
        description: 'Updated hardware details',
      };

      req.params = { id: 'cat_1' };
      req.body = {
        name: 'Updated Hardware',
        description: 'Updated hardware details',
        extraField: 'should_be_ignored', // Ensures controller filters fields
      };

      categoryService.updateCategory.mockResolvedValue(mockUpdatedCategory);

      await updateCategory(req, res, next);

      expect(categoryService.updateCategory).toHaveBeenCalledWith('cat_1', {
        name: 'Updated Hardware',
        description: 'Updated hardware details',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedCategory);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when category update fails', async () => {
      req.params = { id: 'invalid_id' };
      req.body = { name: 'Hardware', description: 'Hardware issues' };
      const mockError = new Error('Category not found');

      categoryService.updateCategory.mockRejectedValue(mockError);

      await updateCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // --- 4. deleteCategory ---
  describe('deleteCategory', () => {
    test('should return 200 and success response object upon deletion', async () => {
      const mockResponse = { message: 'Category deleted successfully' };

      req.params = { id: 'cat_1' };
      categoryService.deleteCategory.mockResolvedValue(mockResponse);

      await deleteCategory(req, res, next);

      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat_1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResponse);
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass error to next middleware when deletion fails', async () => {
      req.params = { id: 'cat_1' };
      const mockError = new Error(
        'Cannot delete category with associated active incidents'
      );

      categoryService.deleteCategory.mockRejectedValue(mockError);

      await deleteCategory(req, res, next);

      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat_1');
      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});