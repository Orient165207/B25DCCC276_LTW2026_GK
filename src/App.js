import { useEffect, useId, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';

const CATEGORIES = ['Văn phòng phẩm', 'Điện tử', 'Gia dụng'];
const PRODUCTS_STORAGE_KEY = 'inventory-products-v1';

const formatCurrency = (amount) => `${amount.toLocaleString('vi-VN')} đ`;

const isProductList = (value) =>
  Array.isArray(value) &&
  new Set(value.map((product) => product?.id)).size === value.length &&
  value.every(
    (product) =>
      product &&
      Number.isInteger(product.id) &&
      product.id > 0 &&
      typeof product.name === 'string' &&
      product.name.trim() !== '' &&
      CATEGORIES.includes(product.category) &&
      Number.isFinite(product.price) &&
      product.price >= 0 &&
      Number.isInteger(product.quantity) &&
      product.quantity >= 0,
  );

function CategorySelect({ label, value, options, onChange, className = '' }) {
  const id = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(options.indexOf(value), 0),
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const openAt = (index) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        openAt(Math.max(options.indexOf(value), 0));
        return;
      }
      setActiveIndex((currentIndex) =>
        (currentIndex + direction + options.length) % options.length,
      );
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      setOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openAt(Math.max(options.indexOf(value), 0));
      } else {
        onChange(options[activeIndex]);
        setOpen(false);
      }
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`field category-field ${className}`.trim()} ref={rootRef}>
      <span id={`${id}-label`}>{label}</span>
      <button
        type="button"
        className={`category-trigger${open ? ' is-open' : ''}`}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openAt(Math.max(options.indexOf(value), 0));
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{value}</span>
        <span className="category-chevron" aria-hidden="true" />
      </button>
      <div
        className={`category-menu${open ? ' is-open' : ''}`}
        id={`${id}-options`}
        role="listbox"
        aria-labelledby={`${id}-label`}
        aria-hidden={!open}
      >
        {options.map((option, index) => (
          <div
            className={`category-option${option === value ? ' is-selected' : ''}${index === activeIndex && open ? ' is-active' : ''}`}
            id={`${id}-option-${index}`}
            key={option}
            role="option"
            aria-selected={option === value}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => {
              onChange(option);
              setOpen(false);
            }}
          >
            <span>{option}</span>
            {option === value && <span className="category-check" aria-hidden="true">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const getRoute = (pathname) => {
  if (pathname === '/') return { page: 'home' };
  if (pathname === '/products') return { page: 'products' };
  if (pathname === '/products/new') return { page: 'new' };

  const detailMatch = pathname.match(/^\/products\/([^/]+)$/);
  if (detailMatch) return { page: 'detail', id: detailMatch[1] };

  return { page: 'not-found' };
};

function App() {
  const [route, setRoute] = useState(() => getRoute(window.location.pathname));
  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [persistenceError, setPersistenceError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [form, setForm] = useState({
    name: '',
    category: CATEGORIES[0],
    price: '',
    quantity: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute(window.location.pathname));
    window.history.replaceState(
      { ...window.history.state, inventoryApp: true },
      '',
      window.location.href,
    );
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    let savedProducts = null;

    try {
      const storedProducts = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (storedProducts !== null) {
        const parsedProducts = JSON.parse(storedProducts);
        if (isProductList(parsedProducts)) {
          savedProducts = parsedProducts;
          setProducts(parsedProducts);
        } else {
          window.localStorage.removeItem(PRODUCTS_STORAGE_KEY);
          setPersistenceError('Dữ liệu đã lưu không hợp lệ; ứng dụng sẽ tải lại danh sách sản phẩm.');
        }
      }
    } catch {
      setPersistenceError('Không thể đọc dữ liệu sản phẩm đã lưu trong trình duyệt.');
    }

    axios
      .get('/data/products.json')
      .then(({ data }) => {
        if (!isProductList(data)) {
          throw new Error('Dữ liệu sản phẩm không hợp lệ.');
        }
        if (active && !savedProducts) setProducts(data);
      })
      .catch(() => {
        if (active && !savedProducts) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!products) return;

    try {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      setPersistenceError('');
    } catch {
      setPersistenceError('Không thể lưu thay đổi. Hãy kiểm tra dung lượng hoặc cài đặt lưu trữ của trình duyệt.');
    }
  }, [products]);

  const navigate = (pathname, replace = false) => {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ inventoryApp: true }, '', pathname);
    setRoute(getRoute(pathname));
  };

  const visibleProducts = useMemo(() => {
    if (!products) return [];
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');

    return products.filter((product) => {
      const matchesName = product.name.toLocaleLowerCase('vi').includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === 'Tất cả' || product.category === categoryFilter;
      return matchesName && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const selectedProduct =
    route.page === 'detail'
      ? products?.find((product) => String(product.id) === route.id)
      : null;

  const updateQuantity = (productId, amount) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, quantity: Math.max(0, product.quantity + amount) }
          : product,
      ),
    );
  };

  const deleteProduct = (productId) => {
    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== productId),
    );
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
    setFormError('');
  };

  const addProduct = (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const price = Number(form.price);
    const quantity = Number(form.quantity);

    if (!name || form.price === '' || form.quantity === '') {
      setFormError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0) {
      setFormError('Giá phải từ 0 trở lên và số lượng phải là số nguyên không âm.');
      return;
    }

    const newProduct = {
      id: products.reduce((highestId, product) => Math.max(highestId, product.id), 0) + 1,
      name,
      category: form.category,
      price,
      quantity,
    };

    setProducts((currentProducts) => [...currentProducts, newProduct]);
    setForm({ name: '', category: CATEGORIES[0], price: '', quantity: '' });
    setFormError('');
    navigate('/products', true);
    navigate(`/products/${newProduct.id}`);
  };

  const goBack = () => {
    if (window.history.state?.inventoryApp && window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/products');
    }
  };

  const renderLoadingOrError = () => {
    if (loadError) {
      return <p className="notice notice-error">Không tải được dữ liệu.</p>;
    }
    if (!products) {
      return <p className="notice">Đang tải...</p>;
    }
    return null;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" onClick={(event) => {
            event.preventDefault();
            navigate('/');
          }}>
            <span className="brand-mark" aria-hidden="true">K</span>
            <span>Kho hàng</span>
          </a>
          <nav className="main-nav" aria-label="Điều hướng chính">
            {[
              { path: '/', label: 'Trang chủ', page: 'home' },
              { path: '/products', label: 'Danh sách', page: 'products' },
              { path: '/products/new', label: 'Thêm mới', page: 'new' },
            ].map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={route.page === item.page ? 'nav-link active' : 'nav-link'}
                aria-current={route.page === item.page ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.path);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {persistenceError && (
        <p className="persistence-notice" role="status">{persistenceError}</p>
      )}

      <main className="page-content">
        {route.page === 'home' && (
          <section>
            <div className="page-heading">
              <div>
                <p className="eyebrow">TỔNG QUAN</p>
                <h1>Kho hàng</h1>
                <p className="page-description">Theo dõi nhanh tình hình hàng hóa của cửa hàng.</p>
              </div>
              <button className="button button-primary" onClick={() => navigate('/products/new')}>
                + Thêm sản phẩm
              </button>
            </div>
            {renderLoadingOrError()}
            {products && (
              <div className="stats-grid">
                <article className="stat-card">
                  <span className="stat-label">Tổng số sản phẩm</span>
                  <strong>{products.length}</strong>
                  <span className="stat-caption">mặt hàng trong kho</span>
                </article>
                <article className="stat-card stat-warning">
                  <span className="stat-label">Sắp hết hàng</span>
                  <strong>{products.filter((product) => product.quantity < 5).length}</strong>
                  <span className="stat-caption">sản phẩm có tồn kho dưới 5</span>
                </article>
                <article className="stat-card stat-value">
                  <span className="stat-label">Tổng giá trị kho</span>
                  <strong>
                    {formatCurrency(
                      products.reduce(
                        (total, product) => total + product.price * product.quantity,
                        0,
                      ),
                    )}
                  </strong>
                  <span className="stat-caption">giá bán × số lượng tồn</span>
                </article>
              </div>
            )}
            <section className="welcome-card">
              <div>
                <h2>Quản lý hàng hóa thật đơn giản</h2>
                <p>Tìm sản phẩm, cập nhật số lượng hoặc xem thông tin chi tiết trong danh sách.</p>
              </div>
              <button className="button button-secondary" onClick={() => navigate('/products')}>
                Xem danh sách
              </button>
            </section>
          </section>
        )}

        {route.page === 'products' && (
          <section>
            <div className="page-heading">
              <div>
                <p className="eyebrow">QUẢN LÝ HÀNG HÓA</p>
                <h1>Danh sách sản phẩm</h1>
                <p className="page-description">Tìm kiếm, lọc và cập nhật tồn kho.</p>
              </div>
              <button className="button button-primary" onClick={() => navigate('/products/new')}>
                + Thêm sản phẩm
              </button>
            </div>
            {renderLoadingOrError()}
            {products && (
              <>
                <div className="filter-bar">
                  <label className="field search-field">
                    <span>Tìm kiếm</span>
                    <input
                      type="search"
                      placeholder="Nhập tên sản phẩm..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <CategorySelect
                    label="Danh mục"
                    value={categoryFilter}
                    options={['Tất cả', ...CATEGORIES]}
                    onChange={setCategoryFilter}
                  />
                </div>
                <p className="result-count">
                  Tìm thấy <strong>{visibleProducts.length}</strong> sản phẩm
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tên sản phẩm</th>
                        <th>Danh mục</th>
                        <th>Giá</th>
                        <th>Tồn kho</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <a
                              className="product-link"
                              href={`/products/${product.id}`}
                              onClick={(event) => {
                                event.preventDefault();
                                navigate(`/products/${product.id}`);
                              }}
                            >
                              {product.name}
                            </a>
                          </td>
                          <td><span className="category-badge">{product.category}</span></td>
                          <td>{formatCurrency(product.price)}</td>
                          <td>
                            <span className={product.quantity < 5 ? 'stock low-stock' : 'stock'}>
                              {product.quantity}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Giảm tồn kho ${product.name}`}
                                disabled={product.quantity === 0}
                                onClick={() => updateQuantity(product.id, -1)}
                              >
                                −
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Tăng tồn kho ${product.name}`}
                                onClick={() => updateQuantity(product.id, 1)}
                              >
                                +
                              </button>
                              <button
                                className="delete-button"
                                onClick={() => deleteProduct(product.id)}
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleProducts.length === 0 && (
                        <tr>
                          <td className="empty-cell" colSpan="5">Không có dữ liệu.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {route.page === 'new' && (
          <section className="form-page">
            <div className="page-heading">
              <div>
                <p className="eyebrow">QUẢN LÝ HÀNG HÓA</p>
                <h1>Thêm sản phẩm mới</h1>
                <p className="page-description">Điền thông tin bên dưới để thêm vào kho.</p>
              </div>
            </div>
            {renderLoadingOrError()}
            {products && (
              <form className="product-form" onSubmit={addProduct} noValidate>
                <label className="field">
                  <span>Tên sản phẩm</span>
                  <input name="name" value={form.name} onChange={handleFormChange} />
                </label>
                <CategorySelect
                  label="Danh mục"
                  value={form.category}
                  options={CATEGORIES}
                  onChange={(category) => {
                    setForm((currentForm) => ({ ...currentForm, category }));
                    setFormError('');
                  }}
                  className="form-category-field"
                />
                <label className="field">
                  <span>Giá (đ)</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={handleFormChange}
                  />
                </label>
                <label className="field">
                  <span>Số lượng tồn</span>
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={form.quantity}
                    onChange={handleFormChange}
                  />
                </label>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="form-actions">
                  <button className="button button-secondary" type="button" onClick={goBack}>
                    Quay lại
                  </button>
                  <button className="button button-primary" type="submit">Thêm</button>
                </div>
              </form>
            )}
          </section>
        )}

        {route.page === 'detail' && (
          <section>
            <button className="back-link" onClick={goBack}>← Quay lại</button>
            {renderLoadingOrError()}
            {products && selectedProduct && (
              <article className="detail-card">
                <p className="eyebrow">CHI TIẾT SẢN PHẨM</p>
                <h1>{selectedProduct.name}</h1>
                <dl className="detail-list">
                  <div><dt>Tên sản phẩm</dt><dd>{selectedProduct.name}</dd></div>
                  <div><dt>Danh mục</dt><dd>{selectedProduct.category}</dd></div>
                  <div><dt>Giá</dt><dd>{formatCurrency(selectedProduct.price)}</dd></div>
                  <div>
                    <dt>Tồn kho</dt>
                    <dd className={selectedProduct.quantity < 5 ? 'low-stock' : ''}>
                      {selectedProduct.quantity}
                    </dd>
                  </div>
                </dl>
              </article>
            )}
            {products && !selectedProduct && (
              <p className="notice notice-error">Không tìm thấy sản phẩm.</p>
            )}
          </section>
        )}

        {route.page === 'not-found' && (
          <section className="not-found">
            <h1>Không tìm thấy trang</h1>
            <button className="button button-secondary" onClick={() => navigate('/')}>
              Về trang chủ
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
