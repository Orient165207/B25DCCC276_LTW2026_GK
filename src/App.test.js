import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios');

const products = [
  { id: 1, name: 'Bút bi Thiên Long', category: 'Văn phòng phẩm', price: 5000, quantity: 20 },
  { id: 2, name: 'Vở kẻ ngang 200 trang', category: 'Văn phòng phẩm', price: 12000, quantity: 3 },
  { id: 3, name: 'Giấy A4 Double A', category: 'Văn phòng phẩm', price: 120000, quantity: 5 },
  { id: 4, name: 'Chuột không dây', category: 'Điện tử', price: 250000, quantity: 4 },
  { id: 5, name: 'Tai nghe có dây', category: 'Điện tử', price: 180000, quantity: 8 },
  { id: 6, name: 'Bình giữ nhiệt', category: 'Gia dụng', price: 29000, quantity: 2 },
];

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  axios.get.mockResolvedValue({ data: products });
});

test('shows inventory statistics from the API data', async () => {
  render(<App />);

  expect(await screen.findByText('3.234.000 đ')).toBeInTheDocument();
  expect(screen.getByText('Tổng số sản phẩm')).toBeInTheDocument();
  expect(screen.getByText('Sắp hết hàng')).toBeInTheDocument();
});

test('combines case-insensitive name search with category filtering', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Danh sách' }));

  const search = await screen.findByPlaceholderText('Nhập tên sản phẩm...');
  const category = screen.getByRole('combobox', { name: 'Danh mục' });
  fireEvent.click(category);
  fireEvent.click(screen.getByRole('option', { name: 'Điện tử' }));
  expect(screen.getByRole('link', { name: 'Chuột không dây' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Tai nghe có dây' })).toBeInTheDocument();

  fireEvent.click(category);
  fireEvent.click(screen.getByRole('option', { name: 'Tất cả' }));
  fireEvent.change(search, { target: { value: 'BÚT' } });
  expect(screen.getByRole('link', { name: 'Bút bi Thiên Long' })).toBeInTheDocument();
  expect(screen.getByText((_, element) => element.classList.contains('result-count')))
    .toHaveTextContent('Tìm thấy 1 sản phẩm');
});

test('updates stock and adds a product with the next ID', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Danh sách' }));

  const search = await screen.findByPlaceholderText('Nhập tên sản phẩm...');
  fireEvent.change(search, { target: { value: 'Vở' } });
  const notebookRow = screen.getByRole('row', { name: /Vở kẻ ngang 200 trang/ });
  fireEvent.click(within(notebookRow).getByRole('button', { name: 'Tăng tồn kho Vở kẻ ngang 200 trang' }));
  fireEvent.click(within(notebookRow).getByRole('button', { name: 'Tăng tồn kho Vở kẻ ngang 200 trang' }));
  expect(within(notebookRow).getByText('5')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: 'Thêm mới' }));
  await screen.findByRole('heading', { name: 'Thêm sản phẩm mới' });
  fireEvent.change(screen.getByLabelText('Tên sản phẩm'), { target: { value: 'Sổ tay' } });
  fireEvent.change(screen.getByLabelText('Giá (đ)'), { target: { value: '15000' } });
  fireEvent.change(screen.getByLabelText('Số lượng tồn'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm', exact: true }));

  expect(await screen.findByRole('heading', { name: 'Sổ tay' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/products/7');
  fireEvent.click(screen.getByRole('button', { name: /Quay lại/ }));
  await waitFor(() => expect(window.location.pathname).toBe('/products'));
  expect(screen.queryByRole('heading', { name: 'Thêm sản phẩm mới' })).not.toBeInTheDocument();
});

test('shows not-found state for an unknown product route', async () => {
  window.history.replaceState({}, '', '/products/99');
  render(<App />);

  expect(await screen.findByText('Không tìm thấy sản phẩm.')).toBeInTheDocument();
});

test('shows a clear message when the products API fails', async () => {
  axios.get.mockRejectedValueOnce(new Error('Network error'));
  render(<App />);

  expect(await screen.findByText('Không tải được dữ liệu.')).toBeInTheDocument();
});

test('restores inventory changes after the app is reopened', async () => {
  const firstRender = render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Danh sách' }));
  const search = await screen.findByPlaceholderText('Nhập tên sản phẩm...');
  fireEvent.change(search, { target: { value: 'Vở' } });

  const notebookRow = screen.getByRole('row', { name: /Vở kẻ ngang 200 trang/ });
  fireEvent.click(
    within(notebookRow).getByRole('button', {
      name: 'Tăng tồn kho Vở kẻ ngang 200 trang',
    }),
  );
  expect(JSON.parse(window.localStorage.getItem('inventory-products-v1'))[1].quantity)
    .toBe(4);

  firstRender.unmount();
  window.history.replaceState({}, '', '/products');
  render(<App />);

  const restoredSearch = await screen.findByPlaceholderText('Nhập tên sản phẩm...');
  fireEvent.change(restoredSearch, { target: { value: 'Vở' } });
  const restoredRow = screen.getByRole('row', { name: /Vở kẻ ngang 200 trang/ });
  expect(within(restoredRow).getByText('4')).toBeInTheDocument();
});

test('requires all form fields and deletes products immediately', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Thêm mới' }));
  await screen.findByRole('heading', { name: 'Thêm sản phẩm mới' });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm', exact: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập đầy đủ thông tin.');

  fireEvent.click(screen.getByRole('link', { name: 'Danh sách' }));
  const search = await screen.findByPlaceholderText('Nhập tên sản phẩm...');
  fireEvent.change(search, { target: { value: 'Bút' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  expect(screen.getByText('Không có dữ liệu.')).toBeInTheDocument();
});
