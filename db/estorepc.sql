-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost
-- Thời gian đã tạo: Th10 29, 2025 lúc 02:08 PM
-- Phiên bản máy phục vụ: 10.4.28-MariaDB
-- Phiên bản PHP: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `estorepc`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `addresses`
--

CREATE TABLE `addresses` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `label` varchar(100) DEFAULT NULL,
  `receiver_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `details` varchar(255) NOT NULL,
  `district` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `addresses`
--

INSERT INTO `addresses` (`id`, `user_id`, `label`, `receiver_name`, `phone`, `details`, `district`, `city`, `postal_code`, `is_default`, `created_at`, `updated_at`) VALUES
(6, 5, 'nhà bạn', 'trần thị b', '0926434153', '12', 'quận 4', 'Huyện Nhà Bè', '', 1, '2025-11-13 19:55:01', '2025-11-21 17:44:55'),
(17, 15, 'Default', 'bảo', '0128498243', 'ádasd', 'ádasdc', 'ádsadcsc', '', 1, '2025-11-21 17:47:17', '2025-11-21 17:47:17'),
(19, 17, 'Default', 'tnb', '', 'áhdh', 'ádbasd', 'ádjabd', '', 1, '2025-11-27 05:25:48', '2025-11-27 05:25:48'),
(20, 20, 'Default', 'jkasdjb', '0926434153', 'ạkbas', 'ậbsx', 'Huyện Nhà Bè', '', 0, '2025-11-27 06:08:23', '2025-11-27 06:10:46'),
(21, 20, 'sjkhb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1, '2025-11-27 06:10:36', '2025-11-27 06:10:46'),
(22, 21, 'Địa chỉ giao hàng', 'Ngọc Dung', '0123456789', 'hádjhbasd', 'ạkxbas', 'ádasdx', '', 1, '2025-11-28 14:19:51', '2025-11-28 14:19:51'),
(23, 22, 'Địa chỉ giao hàng', 'advhjad', 'abdhabsd', 'ándbasd', 'ábndnasd', 'ándnabsd', '', 1, '2025-11-28 16:00:15', '2025-11-28 16:00:15');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `categories`
--

CREATE TABLE `categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `slug` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `categories`
--

INSERT INTO `categories` (`id`, `slug`, `name`) VALUES
(1, 'laptop', 'Laptops'),
(2, 'monitor', 'Monitors'),
(3, 'hard-drive', 'Hard Drives & SSD'),
(4, 'new', 'New Products'),
(5, 'best', 'Best Sellers');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `discount_codes`
--

CREATE TABLE `discount_codes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(5) NOT NULL,
  `percent_off` int(11) NOT NULL,
  `max_uses` int(11) NOT NULL DEFAULT 10,
  `used_count` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `discount_codes`
--

INSERT INTO `discount_codes` (`id`, `code`, `percent_off`, `max_uses`, `used_count`, `created_at`) VALUES
(1, 'SALE1', 10, 5, 2, '2025-11-21 17:43:48'),
(2, 'LAP01', 15, 10, 0, '2025-11-21 17:43:48'),
(3, 'NEW50', 5, 10, 0, '2025-11-21 17:43:48'),
(4, 'ACBDE', 5, 10, 1, '2025-11-29 18:37:48');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `receiver_name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `address_details` varchar(255) NOT NULL,
  `district` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `subtotal` bigint(20) NOT NULL,
  `tax` bigint(20) NOT NULL,
  `shipping_fee` bigint(20) NOT NULL,
  `discount_amount` bigint(20) NOT NULL DEFAULT 0,
  `total_amount` bigint(20) NOT NULL,
  `coupon_code` varchar(10) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `point_discount` int(11) NOT NULL DEFAULT 0,
  `loyalty_points_used` int(11) NOT NULL DEFAULT 0,
  `loyalty_points_earned` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `orders`
--

INSERT INTO `orders` (`id`, `user_id`, `email`, `full_name`, `receiver_name`, `phone`, `address_details`, `district`, `city`, `postal_code`, `subtotal`, `tax`, `shipping_fee`, `discount_amount`, `total_amount`, `coupon_code`, `status`, `created_at`, `point_discount`, `loyalty_points_used`, `loyalty_points_earned`) VALUES
(1, 5, 'admin1@gmail.com', 'trần thị b', 'trần thị b', '0926434153', '12', 'quận 4', 'Huyện Nhà Bè', '', 19990000, 1999000, 0, 2198900, 19790100, 'SALE1', 'pending', '2025-11-21 17:44:55', 0, 0, 0),
(2, 15, 'abc1@gmail.com', 'Nam', 'bảo', '0128498243', 'ádasd', 'ádasdc', 'ádsadcsc', '', 2490000, 249000, 0, 0, 2739000, NULL, 'pending', '2025-11-21 17:47:17', 0, 0, 0),
(3, 5, 'admin1@gmail.com', 'trần thị b', 'trần thị b', '0926434153', '12', 'quận 4', 'Huyện Nhà Bè', '', 2490000, 249000, 0, 273900, 2465100, 'SALE1', 'pending', '2025-11-21 18:00:42', 0, 0, 0),
(4, 5, 'admin1@gmail.com', 'trần thị b', 'trần thị b', '0926434153', '12', 'quận 4', 'Huyện Nhà Bè', '', 2490000, 249000, 0, 0, 2739000, NULL, 'pending', '2025-11-21 19:17:50', 0, 0, 0),
(5, 5, 'admin1@gmail.com', 'trần thị b', 'trần thị b', '0926434153', '12', 'quận 4', 'Huyện Nhà Bè', '', 2490000, 249000, 0, 0, 2739000, NULL, 'pending', '2025-11-21 19:19:11', 0, 0, 0),
(6, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2790000, 279000, 0, 0, 3069000, NULL, 'pending', '2025-11-21 21:34:23', 0, 0, 0),
(7, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2490000, 249000, 0, 0, 2739000, NULL, 'pending', '2025-11-21 21:45:24', 0, 0, 0),
(8, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2490000, 249000, 0, 0, 2739000, NULL, 'pending', '2025-11-23 10:50:21', 0, 0, 0),
(9, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2490000, 249000, 0, 0, 2739000, NULL, 'pending', '2025-11-23 11:25:16', 0, 0, 0),
(10, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 4980000, 498000, 0, 0, 5478000, NULL, 'pending', '2025-11-23 11:50:25', 0, 0, 0),
(11, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2790000, 279000, 0, 0, 3069000, NULL, 'pending', '2025-11-23 12:01:11', 0, 0, 306900),
(12, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2790000, 279000, 0, 0, 3069000, NULL, 'pending', '2025-11-23 12:26:11', 0, 0, 306900),
(13, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2790000, 0, 0, 0, 2790000, NULL, 'pending', '2025-11-23 13:13:57', 0, 0, 279),
(14, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2790000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 13:47:09', 2790000, 2790, 0),
(15, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2490000, 0, 0, 0, 2490000, NULL, 'pending', '2025-11-24 13:48:59', 0, 0, 249),
(16, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2590000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 14:02:28', 2590000, 2590, 0),
(17, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2590000, 0, 0, 0, 1978790, NULL, 'pending', '2025-11-24 14:44:19', 611210, 611210, 197879),
(18, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2590000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 14:52:40', 2590000, 2590, 0),
(19, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2990000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 14:53:11', 2990000, 2990, 0),
(20, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2590000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 14:54:00', 2590000, 2590, 0),
(21, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2590000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 14:54:47', 2590000, 2590, 0),
(22, 16, 'ngbao150205@gmail.com', 'Bảo Trần', 'Bảo Trần', '0926434153', 'sfsdf', 'sdfsdf', 'sdfkjbsdf', '', 2490000, 0, 0, 0, 0, NULL, 'pending', '2025-11-24 15:02:14', 2490000, 2490, 0),
(23, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 2490000, 249000, 30000, 0, 2769000, NULL, 'pending', '2025-11-28 00:43:46', 0, 0, 0),
(24, 21, 'abcd1@gmail.com', 'Ngọc Dung', 'Ngọc Dung', '0123456789', 'hádjhbasd', 'ạkxbas', 'ádasdx', NULL, 6990000, 699000, 30000, 0, 7719000, NULL, 'pending', '2025-11-28 14:19:51', 0, 0, 0),
(25, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1590000, 159000, 30000, 0, 1779000, NULL, 'pending', '2025-11-28 14:47:46', 0, 0, 0),
(26, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 111101010101, 11110101010, 30000, 0, 122211141111, NULL, 'pending', '2025-11-28 14:49:56', 0, 0, 0),
(27, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 6990000, 699000, 30000, 0, 7719000, NULL, 'pending', '2025-11-28 14:53:06', 0, 0, 0),
(28, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 6990000, 699000, 30000, 0, 7719000, NULL, 'pending', '2025-11-28 15:08:46', 0, 0, 0),
(29, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 18990000, 1899000, 30000, 0, 20919000, NULL, 'pending', '2025-11-28 15:25:01', 0, 0, 0),
(30, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1590000, 159000, 30000, 0, 1779000, NULL, 'pending', '2025-11-28 15:38:45', 0, 0, 0),
(31, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1590000, 159000, 30000, 0, 1779000, NULL, 'pending', '2025-11-28 15:39:52', 0, 0, 0),
(32, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 0, 0, 0, 0, 0, NULL, 'pending', '2025-11-28 15:40:21', 0, 0, 0),
(33, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1290000, 129000, 30000, 0, 1449000, NULL, 'pending', '2025-11-28 15:55:00', 0, 0, 0),
(34, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1290000, 129000, 30000, 0, 1449000, NULL, 'pending', '2025-11-28 15:58:15', 0, 0, 0),
(35, 22, 'cc@gmail.com', 'ádbasd', 'advhjad', 'abdhabsd', 'ándbasd', 'ábndnasd', 'ándnabsd', NULL, 1290000, 129000, 30000, 0, 1449000, NULL, 'pending', '2025-11-28 16:00:15', 0, 0, 0),
(36, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1290000, 129000, 30000, 0, 1449000, NULL, 'pending', '2025-11-28 16:24:12', 0, 0, 0),
(37, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1290000, 129000, 30000, 0, 1449000, NULL, 'pending', '2025-11-28 16:54:45', 0, 0, 0),
(38, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1290000, 129000, 30000, 0, 1449000, NULL, 'pending', '2025-11-28 16:58:29', 0, 0, 0),
(39, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 18990000, 1899000, 30000, 0, 20909000, NULL, 'shipping', '2025-11-29 00:21:04', 10000, 10, 2090),
(40, 20, 'ngbao150205@gmail.com', 'jkasdjb', 'jhasvc', '081238127387', 'áhdbasd', 'ádnmbas', 'áhdbasbd', NULL, 1590000, 159000, 30000, 79500, 1699500, 'ACBDE', 'pending', '2025-11-29 18:41:40', 0, 0, 169);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `order_items`
--

CREATE TABLE `order_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `variant_id` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `name` varchar(255) NOT NULL,
  `attrs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attrs`)),
  `unit_price` bigint(20) NOT NULL,
  `qty` int(11) NOT NULL,
  `line_total` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `variant_id`, `name`, `attrs`, `unit_price`, `qty`, `line_total`) VALUES
(1, 1, 16, 31, 'Laptop Acer Aspire Lite 16 AI', '{\"ram\":\"16GB\",\"ssd\":\"512GB\"}', 19990000, 1, 19990000),
(2, 2, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(3, 3, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(4, 4, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(5, 5, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(6, 6, 22, 44, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 2790000, 1, 2790000),
(7, 7, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(8, 8, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(9, 9, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(10, 10, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 2, 4980000),
(11, 11, 22, 44, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 2790000, 1, 2790000),
(12, 12, 22, 44, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 2790000, 1, 2790000),
(13, 13, 22, 44, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 2790000, 1, 2790000),
(14, 14, 22, 44, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 2790000, 1, 2790000),
(15, 15, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(16, 16, 21, 41, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\"}', 2590000, 1, 2590000),
(17, 17, 21, 41, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\"}', 2590000, 1, 2590000),
(18, 18, 21, 41, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\"}', 2590000, 1, 2590000),
(19, 19, 21, 42, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\",\"ip67\":1}', 2990000, 1, 2990000),
(20, 20, 21, 41, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\"}', 2590000, 1, 2590000),
(21, 21, 21, 41, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\"}', 2590000, 1, 2590000),
(22, 22, 22, 43, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 1, 2490000),
(23, 23, 22, 0, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN) (4TB / 7200)', NULL, 2490000, 1, 2490000),
(24, 24, 18, 0, 'Monitor Asus VA229HR 21.5 inch FHD IPS 75Hz (27 / 144)', NULL, 6990000, 1, 6990000),
(25, 25, 11, 0, 'HDD WD 8TB Red Plus (3.5 inch, 5640RPM, SATA, 256MB cache (2TB / 7200)', NULL, 1590000, 1, 1590000),
(26, 26, 24, 0, 'ạkdbjkansd (ạksdnj)', NULL, 111101010101, 1, 111101010101),
(27, 27, 18, 0, 'Monitor Asus VA229HR 21.5 inch FHD IPS 75Hz (27 / 144)', NULL, 6990000, 1, 6990000),
(28, 28, 18, 0, 'Monitor Asus VA229HR 21.5 inch FHD IPS 75Hz (27 / 144)', NULL, 6990000, 1, 6990000),
(29, 29, 13, 0, 'Laptop HP 15 fc0085AU (16GB / 512GB)', NULL, 18990000, 1, 18990000),
(30, 30, 20, 0, 'SSD ADATA SU650 120GB SATA (ASU650SS-120GT-R) (512GB / 4)', NULL, 1590000, 1, 1590000),
(31, 31, 20, 0, 'SSD ADATA SU650 120GB SATA (ASU650SS-120GT-R) (512GB / 4)', NULL, 1590000, 1, 1590000),
(32, 32, 23, 0, 'kjsbcjkbscs', NULL, 0, 1, 0),
(33, 33, 10, 0, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R) (512GB / SATA)', '{\"variantText\":\"512GB / SATA\"}', 1290000, 1, 1290000),
(34, 34, 10, 0, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R) (512GB / SATA)', '{\"variantText\":\"512GB / SATA\"}', 1290000, 1, 1290000),
(35, 35, 10, 0, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R) (512GB / SATA)', '{\"variantText\":\"512GB / SATA\"}', 1290000, 1, 1290000),
(36, 36, 10, 19, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R) (512GB / SATA)', NULL, 1290000, 1, 1290000),
(37, 37, 10, 19, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R) (512GB / SATA)', NULL, 1290000, 1, 1290000),
(38, 38, 10, 19, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R) (512GB / SATA)', NULL, 1290000, 1, 1290000),
(39, 39, 13, 25, 'Laptop HP 15 fc0085AU (16GB / 512GB)', NULL, 18990000, 1, 18990000),
(40, 40, 11, 21, 'HDD WD 8TB Red Plus (3.5 inch, 5640RPM, SATA, 256MB cache (2TB / 7200)', NULL, 1590000, 1, 1590000);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `order_status_history`
--

CREATE TABLE `order_status_history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `status` varchar(50) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `order_status_history`
--

INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `note`, `created_at`) VALUES
(1, 11, 'pending', 'Đơn hàng được tạo từ website', '2025-11-23 12:01:11'),
(2, 12, 'pending', 'Đơn hàng được tạo từ website', '2025-11-23 12:26:11'),
(3, 17, 'pending', 'Đơn hàng được tạo trên website. Trạng thái ban đầu: pending', '2025-11-24 14:44:19'),
(4, 18, 'pending', 'Đơn hàng được tạo trên website. Trạng thái ban đầu: pending', '2025-11-24 14:52:40'),
(5, 19, 'pending', 'Đơn hàng được tạo trên website. Trạng thái ban đầu: pending', '2025-11-24 14:53:11'),
(6, 20, 'pending', 'Đơn hàng được tạo trên website. Trạng thái ban đầu: pending', '2025-11-24 14:54:00'),
(7, 21, 'pending', 'Đơn hàng được tạo trên website. Trạng thái ban đầu: pending', '2025-11-24 14:54:47'),
(8, 22, 'pending', 'Đơn hàng được tạo trên website. Trạng thái ban đầu: pending', '2025-11-24 15:02:14'),
(9, 37, 'pending', 'Đơn hàng được tạo', '2025-11-28 16:54:45'),
(10, 38, 'pending', 'Đơn hàng được tạo', '2025-11-28 16:58:29'),
(11, 39, 'confirmed', 'Change from pending to confirmed', '2025-11-29 18:10:22'),
(12, 39, 'confirmed', 'Change from confirmed to confirmed', '2025-11-29 18:10:46'),
(13, 39, 'shipping', 'Change from confirmed to shipping', '2025-11-29 18:12:37');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `products`
--

CREATE TABLE `products` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `short_desc` text DEFAULT NULL,
  `descriptions` text DEFAULT NULL,
  `sold` bigint(20) NOT NULL DEFAULT 0,
  `avg_rating` decimal(3,2) NOT NULL DEFAULT 0.00,
  `total_reviews` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `products`
--

INSERT INTO `products` (`id`, `name`, `slug`, `brand`, `short_desc`, `descriptions`, `sold`, `avg_rating`, `total_reviews`, `created_at`) VALUES
(1, 'Laptop Dell Inspiron 15 3530', 'Laptop-Dell-Inspiron-15-3530', 'Dell', 'Thiết kế hiện đại, sang trọng Dày 18.99 mm | Khối lượng 1.66 kg Giải quyết đa nhiệm mọi tác vụ hàng ngày Intel Core i5 1334U I RAM 16 GB Không gian hiển thị rộng rãi, thoải mái 15.6 inch | Full HD | WVA | 120 Hz Cung cấp trải nghiệm âm thanh sống động Realtek Audio', 'Công nghệ CPU: Intel Core i5 Raptor Lake - 1334U\nSố nhân: 10\nSố luồng: 12\nTốc độ CPU: 1.30 GHz (Lên đến 4.60 GHz khi tải nặng)\nCard màn hình: Card tích hợp - Intel Iris Xe Graphics\nRAM: 16 GB\nLoại RAM: DDR4 (1 khe 8 GB + 1 khe 8 GB)\nTốc độ Bus RAM: 3200 MHz\nHỗ trợ RAM tối đa: 16 GB\nỔ cứng: 512 GB SSD NVMe PCIe\nKích thước màn hình: 15.6\"\nĐộ phân giải: Full HD (1920 x 1080)\nTần số quét: 120Hz\nCông nghệ màn hình: WVA\nCổng giao tiếp: 1 x USB 2.0, Jack tai nghe 3.5 mm, 1 x USB 3.2, HDMI, USB Type-C\nKết nối không dây: Wi-Fi 6 (802.11ax), Bluetooth 5.3\nKhe đọc thẻ nhớ: SD\nWebcam: HD webcam\nĐèn bàn phím: Không có đèn\nCông nghệ âm thanh: Realtek Audio\nTản nhiệt: Hãng không công bố\nThông tin Pin: 3-cell Li-ion, 41 Wh\nHệ điều hành: Windows 11 Home SL + Office Home 2024 vĩnh viễn + Microsoft 365 Basic\nThời điểm ra mắt: 2025\nKích thước: Dài 358.5 mm - Rộng 235.56 mm - Dày 18.99 mm - 1.66 kg\nChất liệu: Vỏ nhựa', 25, 5.00, 1, '2025-11-13 16:48:58'),
(2, 'Laptop Dell 15 DC15255 - DC5R5802W1', 'dell-15-dc15255', 'Dell', 'Sắc bạc thanh lịch, tối giản\nDày 17 mm | Nặng 1.63 kg\nCấu hình mạnh mẽ, xử lý đa tác vụ\nAMD Ryzen 5 - 7530U | RAM 16 GB\nHình ảnh chân thực, sống động 15.6 inch | Full HD | 120 Hz\nChất lượng âm thanh rõ ràng\nRealtek ALC3204Màn hình 2K, màu chuẩn, phù hợp design.\nMàn hình 2K, màu chuẩn, phù hợp design.\nMàn hình 2K, màu chuẩn, phù hợp design.\nMàn hình 2K, màu chuẩn, phù hợp design.\n', 'Công nghệ CPU: Intel Core i7 Raptor Lake - 1355U\nSố nhân: 10\nSố luồng: 12\nTốc độ CPU: 1.70 GHz (Lên đến 5.00 GHz khi tải nặng)\nCard màn hình: Card tích hợp - Intel UHD Graphics\nRAM: 16 GB\nLoại RAM: DDR4 (1 khe 16 GB + 1 khe rời)\nTốc độ Bus RAM: 2666 MHz\nHỗ trợ RAM tối đa: 16 GB\nỔ cứng: 512 GB SSD NVMe PCIe\nKích thước màn hình: 15.6\"\nĐộ phân giải: Full HD (1920 x 1080)\nTấm nền: IPS\nTần số quét: 120Hz\nCông nghệ màn hình: Chống chói Anti Glare 250 nits\nCổng giao tiếp: 1 x USB 2.0, Jack tai nghe 3.5 mm, 1 x USB 3.2, HDMI, 1 x USB Type-C (chỉ hỗ trợ truyền dữ liệu)\nKết nối không dây: Bluetooth 5.2, Wi-Fi 6 (802.11ax)\nKhe đọc thẻ nhớ: SD\nWebcam: Full HD Webcam\nĐèn bàn phím: Không có đèn\nCông nghệ âm thanh: Realtek Audio\nTản nhiệt: Hãng không công bố\nThông tin Pin: 4-cell, 54Wh\nHệ điều hành: Windows 11 Home SL + Office Home 2024 vĩnh viễn + Microsoft 365 Basic\nThời điểm ra mắt: 2025\nKích thước: Dài 358.5 mm - Rộng 235 mm - Dày 17.5 mm - 1.65 kg\nChất liệu: Vỏ nhựa\n', 40, 4.70, 23, '2025-11-13 16:48:58'),
(3, 'SSD Adata LEGEND 710 1TB M.2 NVMe Gen3 X4 (ALEG-710-1TCS)', 'SSD-Adata-LEGEND-710', 'Adata', 'Ổ cứng ADATA LEGEND 710 1TB là lựa chọn phù hợp cho các chuyên gia sáng tạo và người dùng cần hiệu suất cao. Với tốc độ đọc/ghi lên tới 2.400/1.800 MB/giây, chuẩn PCIe Gen3 x4 và thiết kế tản nhiệt hiệu quả, sản phẩm mang lại trải nghiệm mượt mà, ổn định. Thuộc phân khúc cận cao cấp, LEGEND 710 phù hợp cho máy tính để bàn và laptop, hỗ trợ nâng cấp dễ dàng, đảm bảo bảo mật dữ liệu với mã hóa AES 256-bit và độ bền vượt trội nhờ công nghệ 3D NAND.', 'ADATA LEGEND 710 cung cấp dung lượng 1TB, đáp ứng nhu cầu lưu trữ lớn cho các chuyên gia sáng tạo, game thủ và người dùng đa nhiệm. Sử dụng công nghệ 3D NAND, ổ cứng này cho phép lưu trữ dữ liệu hiệu quả hơn so với NAND 2D truyền thống nhờ cấu trúc xếp chồng, tăng mật độ lưu trữ mà vẫn đảm bảo độ bền. Với chuẩn M.2 2280 và giao diện PCIe Gen3 x4, sản phẩm phù hợp cho cả laptop và máy tính để bàn, mang lại sự linh hoạt trong việc nâng cấp hệ thống.', 60, 4.80, 35, '2025-11-13 16:48:58'),
(4, 'Laptop Dell Gaming Alienware 16 Aurora AC16250 - 71072939', 'del-alienware-16-aurora', 'Dell', 'Máy 15 inch cho dev, cấu hình khá.\nDòng 2 mô tả.\nDòng 3 mô tả.\nDòng 4 mô tả.\nDòng 5 mô tả.', 'Công nghệ CPU: Intel Core 7 Raptor Lake - 240H\nSố nhân: 10\nSố luồng: 16\nTốc độ CPU: 1.80 GHz (Lên đến 5.20 GHz khi tải nặng)\nCard màn hình: Card rời - NVIDIA GeForce RTX 5060, 8 GB\nRAM: 32 GB\nLoại RAM: DDR4 (1 khe 16 GB + 1 khe rời)\nTốc độ Bus RAM: 5600 MHz\nHỗ trợ RAM tối đa: 32 GB\nỔ cứng: 1 TB SSD NVMe PCIe Gen 4 x 4\nKích thước màn hình: 16\"\nĐộ phân giải: WQXGA (2560 x 1600)\nTấm nền: IPS\nTần số quét: 120Hz\nCông nghệ màn hình: 300 nits, WVA, ComfortView Plus\nCổng giao tiếp: 2 x USB 3.2 Gen 1, Jack tai nghe 3.5 mm, 1 x USB Type-C 3.2 (hỗ trợ DisplayPort), LAN (RJ45), HDMI 2.1, 1 x USB Type-C 3.2 (hỗ trợ Power Delivery và DisplayPort)\nType-C (chỉ hỗ trợ truyền dữ liệu)\nKết nối không dây: Wi-Fi 7 (802.11be), Bluetooth 5.4\nKhe đọc thẻ nhớ: SD\nWebcam: HD Webcam\nĐèn bàn phím: Đơn sắc - Màu trắng\nCông nghệ âm thanh: Realtek Audio\nTản nhiệt: 2 quạt\nThông tin Pin: 6-cell Li-ion, 96 Wh\nHệ điều hành: Windows 11 Home SL + Office Home 2024 + Microsoft 365 Basic 1 năm\nThời điểm ra mắt: 2025\nKích thước: Dài 356.98 mm - Rộng 265.43 mm - Dày 18.61 mm - 2.49 kg\nChất liệu: Vỏ nhựa -nắp lưng bằng kim loại', 15, 4.50, 4, '2025-11-16 00:00:00'),
(5, 'Laptop Asus Vivobook Go 15 E1504FA', 'asus-vivobook-go-15', 'Asus', 'Thiết kế đơn giản, sang trọng\nSắc bạc trang nhã I Nặng 1.63 kg\nĐáp ứng tốt các tác vụ văn phòng\nAMD Ryzen 5 - 7520U I RAM 16 GB\nMàn hình rộng lớn, rõ nét 15.6 inch | Full HD I Anti Glare\nÂm thanh to rõ, mượt mà\nSonicMaster audio', 'Công nghệ CPU: AMD Ryzen 5 - 7520U\nSố nhân:4\nSố luồng:8\nTốc độ CPU:2.80 GHz (Lên đến 4.30 GHz khi tải nặng)\nCard màn hình: Card tích hợp - AMD Radeon Graphics\nRAM:16 GB\nLoại RAM: LPDDR5 (Onboard)\nTốc độ Bus RAM: 5500 MHz\nHỗ trợ RAM tối đa: Không hỗ trợ nâng cấp\nỔ cứng: 512 GB SSD NVMe PCIe (Có thể tháo ra, lắp thanh khác tối đa 1 TB)\nKích thước màn hình: 15.6\"\nĐộ phân giải: Full HD (1920 x 1080)\nTấm nền: TN\nTần số quét: 60Hz\nĐộ phủ màu: 45% NTSC\nCông nghệ màn hình: Chống chói Anti Glare 250 nits\nCổng giao tiếp: 1 x USB 2.0, Jack tai nghe 3.5 mm, 1 x USB 3.2, HDMI, USB Type-C\nKết nối không dây: Wi-Fi 6E (802.11ax), Bluetooth 5.3\nWebcam: HD webcam\nĐèn bàn phím: Không có đèn\nBảo mật: Công tắc khoá camera, Bảo mật vân tay\nCông nghệ âm thanh:SonicMaster audio\nTản nhiệt: Hãng không công bố\nTính năng khác: Độ bền chuẩn quân đội MIL STD 810H, Bản lề mở 180 độ\nThông tin Pin: 3-cell Li-ion, 42 Wh\nHệ điều hành: Windows 11 Home SL\nThời điểm ra mắt: 2023\nKích thước: Dài 360.3 mm - Rộng 232.5 mm - Dày 17.9 mm - 1.63 kg\nChất liệu: Vỏ nhựa', 22, 4.30, 6, '2025-11-16 00:05:00'),
(6, 'Laptop Asus TUF Gaming F16 FX607VJ', 'asus-tuf-gaming-f16', 'Asus', 'Với những game thủ và người dùng chuyên nghiệp đang tìm kiếm một cỗ máy mạnh mẽ để chinh phục mọi thử thách, chiếc laptop Asus TUF Gaming F16 FX607VJ Core 5 210H (RL034W) là một lựa chọn không thể bỏ qua. Không chỉ sở hữu hiệu năng vượt trội, thiết kế hầm hố đậm chất gaming mà chiếc laptop này còn mang đến những trải nghiệm tuyệt vời cho cả game thủ lẫn những người làm kỹ thuật, dựng video. Với mức giá hợp lý, đây chắc chắn là một \"chiến binh\" đáng gờm trong phân khúc laptop gaming tầm trung.', 'Công nghệ CPU: Intel Core 5 Raptor Lake - 210H\nSố nhân: 8\nSố luồng: 12\nTốc độ CPU: 2.20 GHz (Lên đến 4.80 GHz khi tải nặng)\nCard màn hình: Card rời - NVIDIA GeForce RTX 3050, 6 GB\nRAM: 16 GB\nLoại RAM: DDR4 (1 khe 16 GB + 1 khe rời)\nTốc độ Bus RAM: 3200 MHz\nHỗ trợ RAM tối đa: 64 GB\nỔ cứng: 512 GB SSD NVMe PCIe (Có thể tháo ra, lắp thanh khác tối đa 2 TB)\nKích thước màn hình: 16\"\nĐộ phân giải: Full HD+\nTấm nền: IPS\nTần số quét: 144Hz\nĐộ phủ màu: 45% NTSC \nCông nghệ màn hình: Chống chói Anti Glare 300 nits\nThời gian phản hồi: 3 ms\nCổng giao tiếp: Jack tai nghe 3.5 mm, 2 x USB 3.2, HDMI, LAN (RJ45), 1 x USB Type-C 3.2 (hỗ trợ Power Delivery và DisplayPort)\nKết nối không dây: Wi-Fi 6 (802.11ax), Bluetooth 5.3\nWebcam: HD webcam\nĐèn bàn phím: Đèn chuyển màu RGB - 1 vùng\nCông nghệ âm thanh: Hi-Res Audio, Dolby Atmos\nTản nhiệt: Hãng không công bố\nThông tin Pin: 4-cell, 56Wh\nHệ điều hành: Windows 11 Home SL\nThời điểm ra mắt: 2025\nKích thước: Dài 354 mm - Rộng 251 mm - Dày 26.7 mm - 2.2 kg\nChất liệu: Vỏ nhựa - nắp lưng bằng kim loại\n', 9, 4.10, 3, '2025-11-16 00:10:00'),
(7, 'Monitor Dell U2520D (25 inch/QHD/IPS/60Hz/ 5ms/350 nits/HDMI+DP+USB-C)', 'monitor-dell-u2520d', 'Dell', 'Tái tạo màu sắc trung thực với độ bao phủ màu rộng bao gồm 99% sRGB 99% Rec 709 và 95% DCI-P3 Với độ phủ màu lớn hơn khoảng 25% so với sRGB DCI-P3 đang trở thành tiêu chuẩn màu mới.', '\nBề mặt	\nMàn hình phẳng\n\nĐộ phân giải	\nQHD (2560×1440)\n\nKhoảng giá	\n7 triệu – 10 triệu\n\nHãng sản xuất	\nDell\n\nKích thước	\n22 inch – 24 inch\n\nTấm nền	\nIPS\n\nTần số quét	\n60 HZ', 35, 4.80, 12, '2025-11-16 00:15:00'),
(8, 'Monitor Dell P2421D 23.8Inch 2K IPS', 'monitor-dell-p2419hc-23-8inch-ips', 'Dell', ' Kích thước màn hình: 23.8Inch IPS\nĐộ phân giải: 1920×1200', '\nSản phẩm	Màn hình\nTên Hãng	Dell\nModel	P2421D\nKiểu màn hình	Màn hình văn phòng\nKích thước màn hình	23.8Inch IPS\nĐộ sáng	300cd/m2\nTỷ lệ tương phản	1000:1\nĐộ phân giải	2K (2560×1440)\nThời gian đáp ứng	5ms\nGóc nhìn	178°/178°\nTần số quét	60HZ\nCổng giao tiếp	1 x HDMI 1.4, 1 x DP 1.2\nPhụ kiện đi kèm	Cáp nguồn\n1x DP Cable (DP to DP)\n1 x USB 3.0 upstream cable (enables the USB port on the monitor)\nQuick Setup Guide\nTính năng khác	đang cập nhật\nXuất xứ	Chính hãng', 18, 4.60, 7, '2025-11-16 00:20:00'),
(9, 'Monitor Gaming Asus TUF VG279Q1A (27 inch – FHD – IPS – 165Hz- 1ms – FreeSync – Speaker)', 'monitor-gaming-asus-tuf', 'Asus', 'Kiểu dáng màn hình: Phẳng\nTỉ lệ khung hình: 16:9\nKích thước mặc định: 27 inch\nCông nghệ tấm nền: IPS\nPhân giải điểm ảnh: FHD – 1920 x 1080\nĐộ sáng hiển thị: 250 Nits cd/m2\nTần số quét màn: 144Hz (HDMI) – 165Hz (Displayport) (Hezt)\nThời gian đáp ứng: 1ms MPRT\nChỉ số màu sắc: 16.7 triệu màu\nHỗ trợ tiêu chuẩn: VESA (100 mm x 100 mm)\nCổng cắm kết nối: 1xDP 1.2, 2xHDMI 1.4, 1x Audio Out 3.5mm, Loa ngoài (2Wx2)\nPhụ kiện trong hộp: Dây nguồn, Dây Displayport', 'Màn hình Asus TUF GAMING VG279Q1A là màn hình 27 inch, được trang bị công nghệ ELMB độc quyền kết hợp với công nghệ đồng bộ hóa thích ứng AMD Freesync giúp game thủ đắm chìm vào những trận game đầy gây cấn. Thiết kế màn hình đẹp và hiện đại làm cho không gian chơi game của bạn trở nên sang trọng và hút mắt hơn.\n\nKhả năng hiển thị tốt\nMàn hình Asus TUF GAMING VG279Q1A được trang bị màn hình với kích thước 27 inch tiêu chuẩn. Độ phân giải Full HD dưới tấm nền IPS cho màu sắc hiển thị tốt và rõ nét hơn. VG279Q1A còn có khả năng mang đến hình ảnh tuyệt đẹp từ mọi góc độ với góc nhìn rộng 178 độ đảm bảo giảm thiểu sự biến dạng và chuyển màu ngay cả khi bạn đang xem từ các vị trí khác nhau.\n\nThiết kế TUF GAMING VG279Q1A độc đáo\nĐược lấy cảm hứng từ những chiếc máy bay chiến đấu mạnh mẽ nên TUF GAMING VG279Q1A sở hữu thiết kế năng động và mang hơi hướng tương lai. Bảng điều khiển phía sau có các chi tiết giống như cánh, tạo cảm giác tốc độ. Chân đế nhỏ gọn, tối giản đảm bảo sự ổn định nhưng vẫn giữ được nét sang trọng.', 11, 4.40, 5, '2025-11-16 00:25:00'),
(10, 'SSD ADATA 2.5\" SU650 SATA III 256G (ASU650SS-256GT-R)', 'SSD-ADATA-SU650', 'Adata', 'Ổ cứng SSD ADATA 2.5\" SU650 SATA III 256G là giải pháp nâng cấp hiệu quả, mang đến tốc độ vượt trội cho máy tính cá nhân. Với dung lượng 256GB cùng giao diện SATA III và công nghệ 3D-NAND tiên tiến, cung cấp hiệu suất đọc lên đến 520MB/s và ghi 450MB/s. Thiết bị giúp tăng tốc độ khởi động hệ thống, tải ứng dụng nhanh chóng và cải thiện trải nghiệm sử dụng hàng ngày, phù hợp với nhu cầu của người dùng phổ thông.', 'Hiệu suất ổn định với SATA III: Tốc độ đọc 520MB/s và ghi 450MB/s, cải thiện đáng kể tốc độ khởi động, tải ứng dụng và truy xuất dữ liệu hàng ngày.\nDung lượng 256GB phù hợp: Cung cấp không gian lưu trữ đủ cho hệ điều hành, phần mềm cơ bản và dữ liệu cá nhân, lý tưởng để nâng cấp hệ thống cũ.\nCông nghệ 3D-NAND bền bỉ: Tăng cường độ tin cậy và tuổi thọ cho ổ cứng, đảm bảo hoạt động ổn định trong thời gian dài.\nThiết kế 2.5 inch nhỏ gọn: Tương thích rộng rãi với hầu hết các dòng laptop và máy tính để bàn, dễ dàng lắp đặt.\nBảo hành 36 tháng: Đảm bảo sự an tâm cho người dùng về chất lượng và độ bền của sản phẩm trong suốt quá trình sử dụng.', 45, 4.90, 20, '2025-11-16 00:30:00'),
(11, 'HDD WD 8TB Red Plus (3.5 inch, 5640RPM, SATA, 256MB cache', 'HDD-WD-RED-PLUS', 'WD', 'Thương hiệu: WD\nBảo hành: 36 tháng\nKiểu ổ cứng: HDD\nMàu sắc của ổ cứng: Đỏ\nDung lượng: 8TB\nKích thước: 3.5\"\nTốc độ vòng quay: 5640RPM\nCache: 256MB', 'Sức mạnh để xử lý cùng với thiết bị NAS cho doanh nghiệp vừa, nhỏ và cho khách hàng SOHO, WD Red ™ Plus lý tưởng để lưu trữ và chia sẻ, cũng như xây dựng lại mảng RAID trên các hệ thống sử dụng ZFS và các hệ thống tệp khác.HDD WD Red Plus Được xây dựng và thử nghiệm cho các hệ thống NAS 8-khoang, những ổ đĩa này mang đến cho bạn sự linh hoạt và tự tin trong việc lưu trữ và chia sẻ các dữ quan trọng ở nhà và cơ quan của bạn.', 27, 4.20, 9, '2025-11-16 00:35:00'),
(12, 'SSD ADATA LEGEND 860 NVMe PCIe Gen4 x4 M.2 2280 2TB (SLEG-860-2000GCS)', 'SSD-ADATA-LEGEND-860', 'Adata', '- Dung lượng: 2TB\n- Kích thước: M.2 2280\n- Kết nối: PCIe\n- NAND: 3D-NAND\n- Tốc độ đọc/ghi (tối đa): 6000MB/s | 5000MB/s', '0', 8, 4.70, 4, '2025-11-16 00:40:00'),
(13, 'Laptop HP 15 fc0085AU', 'hp-15-fc0085au', 'HP', 'Nổi bật và quá thân quen trong phân khúc laptop học tập - văn phòng giá rẻ, chiếc laptop HP 15 fc0085AU R5 7430U (A6VV8PA) với cấu hình ổn định, vận hành hiệu quả mọi tác vụ từ làm việc đến giải trí đa phương tiện. Máy hội tụ đầy đủ các yếu tố để trở thành bạn trợ thủ lý tưởng cho người dùng.', 'Công nghệ CPU: AMD Ryzen 5 -74330U\nSố nhân: 6\nSố luồng: 12\nTốc độ CPU: 2.30 GHz (Lên đến 5.20 GHz khi tải nặng)\nCard màn hình: Card tích hợp - AMD Radeon Graphics\nRAM: 16 GB\nLoại RAM: DDR4 (1 khe 8 GB + 1 khe 8 GB)\nTốc độ Bus RAM: 3200 MHz\nHỗ trợ RAM tối đa: 16 GB\nỔ cứng: 512 GB SSD NVMe PCIe\nKích thước màn hình: 15.6\"\nĐộ phân giải: WQXGA (2560 x 1600)\nTấm nền: IPS\nTần số quét: 60Hz\nCông nghệ màn hình: Chống chói Anti Glare 250 nits\nCổng giao tiếp: 2 x USB 3.2 Gen 1, Jack tai nghe 3.5 mm, 1 x USB Type-C 3.2 (hỗ trợ DisplayPort), LAN (RJ45), HDMI 2.1, 1 x USB Type-C 3.2 (hỗ trợ Power Delivery và DisplayPort)\nType-C (chỉ hỗ trợ truyền dữ liệu)\nKết nối không dây: Wi-Fi 7 (802.11be), Bluetooth 5.4\nKhe đọc thẻ nhớ: SD\nWebcam: HD Webcam\nĐèn bàn phím: không có đèn\nCông nghệ âm thanh: loa kép(2 kênh)\nTản nhiệt: hãng không công bố\nThông tin Pin: 3-cell Li-ion, 41 Wh\nHệ điều hành: Windows 11 Home SL\nThời điểm ra mắt: 2023\nKích thước: Dài 359.8 mm - Rộng 236 mm - Dày 18.6 mm - 1.59 kg\nChất liệu: Vỏ nhựa\n', 12, 4.60, 5, '2025-11-16 01:00:00'),
(14, 'Laptop HP Gaming VICTUS 15 fa2731TX', 'hp-victus-15', 'HP', 'Laptop gaming đỉnh cao cho dân kỹ thuật, dựng video và game thủ chuyên nghiệp đã xuất hiện! HP VICTUS 15 fa2731TX i5 13420H (B85LNPA) chính là cỗ máy mạnh mẽ, cân mọi tác vụ từ thiết kế đồ họa, dựng phim đến chiến game AAA. Với hiệu năng vượt trội, thiết kế hầm hố và màn hình sắc nét, đây chắc chắn là một khoản đầu tư xứng đáng cho những ai tìm kiếm sự hoàn hảo.', 'Công nghệ CPU: Intel Core i5 Raptor Lake - 13420H\nSố nhân: 8\nSố luồng: 12\nTốc độ CPU: 2.10 GHz (Lên đến 4.60 GHz khi tải nặng)\nCard màn hình: Card rời - NVIDIA GeForce RTX 3050, 6 GB\nSố nhân GPU: 2304 CUDA Cores\nCông suất đồ hoạ - TGP: 70 W\nRAM: 16 GB\nLoại RAM: DDR4 (1 khe 16 GB + 1 khe rời)\nTốc độ Bus RAM: 3200 MHz\nHỗ trợ RAM tối đa: 32 GB\nỔ cứng: 512 GB SSD NVMe PCIe (Có thể tháo ra, lắp thanh khác tối đa 2 TB)\nKích thước màn hình: 15.6\"\nĐộ phân giải: Full HD (1920 x 1080)\nTấm nền: IPS\nTần số quét: 144Hz\nCông nghệ màn hình: Chống chói Anti Glare 300 nits\nCổng giao tiếp: 2 x USB 3.2 Gen 1, Jack tai nghe 3.5 mm, 1 x USB Type-C 3.2 (hỗ trợ DisplayPort), LAN (RJ45), HDMI 2.1, 1 x USB Type-C 3.2 (hỗ trợ Power Delivery và DisplayPort)\nType-C (chỉ hỗ trợ truyền dữ liệu)\nKết nối không dây: Wi-Fi 6 (802.11ax), Bluetooth 5.4\nKhe đọc thẻ nhớ: SD\nWebcam: HD Webcam\nĐèn bàn phím: Đơn sắc - Màu trắng\nCông nghệ âm thanh: Audio by B&O, Realtek High Definition Audio, HP Audio Boost, DTS:X ULTRA\nTản nhiệt: hãng không công bố\nThông tin Pin: 3-cell, 52.5Wh\nHệ điều hành: Windows 11 Home SL\nThời điểm ra mắt: 2024\nKích thước: Dài 357.9 mm - Rộng 255 mm - Dày 23.5 mm - 2.29 kg\nChất liệu: Vỏ nhựa', 9, 4.50, 4, '2025-11-16 01:05:00'),
(15, 'Laptop Acer Gaming Nitro V 15 ANV15 41 R1JY', 'acer-nitro-v-15', 'Acer', 'Laptop Acer Nitro V 15 ANV15 41 R1JY R5 6600H (NH.QPFSV.001) thanh thoát, mướt mắt nhưng vẫn toát lên dáng vẻ mạnh mẽ cá tính với nhiều hoạ tiết độc đáo đi kèm hiệu năng vượt trội từ card rời RTX 30 series. Mẫu laptop gaming từ nhà Acer này sẽ là chiến hữu tuyệt vời cùng anh em bất bại ở mọi thể loại game.', 'Công nghệ CPU: AMD Ryzen 5 - 6600H\nSố nhân: 6\nSố luồng: 12\nTốc độ CPU: 3.30 GHz (Lên đến 4.50 GHz khi tải nặng)\nCard màn hình:  Card rời - NVIDIA GeForce RTX 3050, 6 GB\nSố nhân GPU: Hãng không công bố\nRAM: 16 GB\nLoại RAM: DDR5 (1 khe 16 GB + 1 khe rời)\nTốc độ Bus RAM: 4800 MHz\nHỗ trợ RAM tối đa: 96 GB\nỔ cứng: 512 GB SSD NVMe PCIe (Có thể tháo ra, lắp thanh khác tối đa 4 TB)\nKích thước màn hình: 15.6\"\nĐộ phân giải: Full HD (1920 x 1080)\nTấm nền: IPS\nTần số quét: 165 Hz\nCông nghệ màn hình: Acer ComfyView\nCổng giao tiếp: 2 x USB 3.2 Gen 1, Jack tai nghe 3.5 mm, 1 x USB Type-C 3.2 (hỗ trợ DisplayPort), LAN (RJ45), HDMI 2.1, 1 x USB Type-C 3.2 (hỗ trợ Power Delivery và DisplayPort)\nType-C (chỉ hỗ trợ truyền dữ liệu)\nKết nối không dây: Wi-Fi 802.11 a/b/g/n/ac, Bluetooth 5\nKhe đọc thẻ nhớ: SD\nWebcam: HD Webcam\nĐèn bàn phím: Đơn sắc - Màu trắng\nCông nghệ âm thanh: Spatial Audio, Acer Purified Voice, Acer TrueHarmony, DTS:X ULTRA\nTản nhiệt: hãng không công bố\nThông tin Pin: 4-cell, 57Wh\nHệ điều hành: Windows 11 Home SL\nThời điểm ra mắt: 2024\nKích thước: Dài 362.3 mm - Rộng 239.89 mm - Dày 23.5 mm - 2.1 kg\nChất liệu: Vỏ nhựa', 7, 4.10, 3, '2025-11-16 01:10:00'),
(16, 'Laptop Acer Aspire Lite 16 AI', 'acer-aspire-lite-16-ai', 'Acer', 'Laptop Acer Aspire Lite 16 AI AL16 71P 5674 Ultra 5 125H (NX.D4XSV.001) là chiếc laptop lý tưởng cho học sinh, sinh viên và nhân viên văn phòng, đồng thời đáp ứng tốt nhu cầu thiết kế đồ họa cơ bản. Với hiệu năng mạnh mẽ, thiết kế tinh tế và màn hình sắc nét, chiếc laptop này hứa hẹn mang đến trải nghiệm làm việc và giải trí tuyệt vời, là sự đầu tư thông minh cho năng suất và sáng tạo.', 'Công nghệ CPU: Intel Core Ultra 5 Meteor Lake - 125H\nSố nhân: 14\nSố luồng: 18\nTốc độ CPU: 3.60 GHz (Lên đến 4.50 GHz khi tải nặng)\nCard màn hình:  Card tích hợp - Intel Arc Graphics\nSố nhân GPU: Hãng không công bố\nRAM: 16 GB\nLoại RAM: DDR5 (1 khe 8 GB + 1 khe 8 GB)\nTốc độ Bus RAM: 5600 MHz\nHỗ trợ RAM tối đa: 64 GB\nỔ cứng: 512 GB SSD NVMe PCIe Gen 4 (Có thể tháo ra, lắp thanh khác tối đa 2 TB)\nKích thước màn hình: 16\"\nĐộ phân giải: Full HD+ (1920 x 1200)\nTấm nền: IPS\nTần số quét: 60 Hz\nCông nghệ màn hình: LED Backlit, Acer ComfyView, WVA\nCổng giao tiếp: 2 x USB 3.2 Gen 1, Jack tai nghe 3.5 mm, 1 x USB Type-C 3.2 (hỗ trợ DisplayPort), LAN (RJ45), HDMI 2.1, 1 x USB Type-C 3.2 (hỗ trợ Power Delivery và DisplayPort)\nType-C (chỉ hỗ trợ truyền dữ liệu)\nKết nối không dây: Wi-Fi 802.11 a/b/g/n/ac, Bluetooth 5\nKhe đọc thẻ nhớ: SD\nWebcam: HD Webcam\nĐèn bàn phím: Đơn sắc - Màu trắng\nCông nghệ âm thanh: Spatial Audio, Acer Purified Voice, Acer TrueHarmony, DTS:X ULTRA\nTản nhiệt: hãng không công bố\nThông tin Pin: 4-cell, 57Wh\nHệ điều hành: Windows 11 Home SL\nThời điểm ra mắt: 2024\nKích thước: Dài 362.3 mm - Rộng 239.89 mm - Dày 23.5 mm - 2.1 kg\nChất liệu: Vỏ nhựa', 5, 4.30, 2, '2025-11-16 01:15:00'),
(17, 'Monitor ASUS VZ27EHF (27 inch – IPS – FHD – 1ms – 100Hz)', 'monitor-asus-vz27ehf', 'Asus', 'Kiểu dáng màn hình: Phẳng (Màu Đen)\nTỉ lệ khung hình: 16:9\nKích thước mặc định: 27 inch\nCông nghệ tấm nền: IPS\nPhân giải điểm ảnh: FHD – 1920 x 1080\nĐộ sáng hiển thị: 250 Nits cd/m2\nTần số quét màn: 100Hz\nThời gian đáp ứng: 1ms MPRT\nChỉ số màu sắc: 16.7 triệu màu\nHỗ trợ tiêu chuẩn: VESA (75 mm x 75 mm) – Flicker-free – Low Blue Light\nCổng cắm kết nối: HDMI(v1.4) x 1\nPhụ kiện trong hộp: Dây nguồn, Dây HDMI', 'Màn Hình ASUS VZ27EHF\nKhi bạn tìm kiếm sự kết hợp hoàn hảo giữa thiết kế hiện đại và chất lượng hình ảnh xuất sắc cho màn hình máy tính của mình, màn hình ASUS VZ27EHF Ultra-slim là một lựa chọn không thể bỏ qua. Với thiết kế siêu mỏng và tính năng vượt trội, chiếc màn hình này sẽ không chỉ làm cho không gian làm việc của bạn trở nên sang trọng hơn mà còn cung cấp trải nghiệm hình ảnh đỉnh cao.Màn hình ASUS VZ27EHF thể hiện sự tiết kiệm diện tích với thiết kế siêu mỏng, chỉ có độ dày 7mm tại điểm mỏng nhất với kích thước 27 inch, thể hiện sự tối giản và tinh tế trong thiết kế của mình. Sự xuất hiện của không khung viền tạo nên một sự liền mạch hóa hấp dẫn, đặc biệt thích hợp cho các thiết lập đa màn hình, mang lại trải nghiệm sâu sắc hơn cho người dùng.', 14, 4.80, 6, '2025-11-16 01:20:00'),
(18, 'Monitor Asus VA229HR 21.5 inch FHD IPS 75Hz', 'monitor-asus-va229hr-7', 'Asus', 'Kích thước: 21.5 inch\nĐộ phân giải: 1920 x 1080\nTấm nền: IPS\nTần số quét: 75Hz\nThời gian đáp ứng: 5ms\nKết nối: HDMI (v1.4) x 1, VGA x 1\nPhụ kiện: dây nguồn, dây hdmi', 'Màn hình Asus VA229HR được thiết kế không khung viền giúp cho màn hình trở nên lí tưởng hơn với các cấu hình đa màn hình gần như liền mạch để bạn có được trải nghiệm xem đắm chìm.\n\nMàn hình Asus VA229HR 1\n\nHình ảnh hiển thị vượt trội\nMàn hình Asus VA229HR có tấm nền IPS 21.5 inch với độ phân giải Full HD (1920 x 1080), giúp mang lại góc nhìn rộng 178° và chất lượng hình ảnh sống động. Tầm nhìn rộng nhờ trang bị tấm nền IPS cùng góc xem rộng lên tới 178°, giảm thiểu sự thay đổi sắc màu, cho màu sắc đồng đều và chính xác tại bất kỳ góc xem nào để mang lại trải nghiệm xem tốt hơn.\nTrải nghiệm xem sống động\nTốc độ làm mới lên đến 75Hz với công nghệ Adaptive-Sync/ FreeSync™ để loại bỏ bóng mờ và đảm bảo video phát lại được sắc nét và rõ ràng.\n\nCông nghệ Adaptive-Sync/FreeSync™ giúp loại bỏ hiện tượng xé hình và tốc độ khung hình bị lag, mang đến cho bạn hình ảnh liền mạch và chơi game mượt mà. Màn hình văn phòng với công nghệ này sẽ mang lại cho bạn ưu thế trong các tựa game bắn súng góc nhìn thứ nhất, đua xe, chiến lược thời gian thực và thể thao.', 19, 4.70, 8, '2025-11-16 01:25:00'),
(19, 'Monitor Asus TUF Gaming VG30VQL1A 29.5 inch WFHD VA 200Hz Cong', 'monitor-asus-vg30vq1a-6', 'Asus', 'Kích thước: 29.5″\nĐộ phân giải: 2560X1080 ( 21:9 )\nCông nghệ tấm nền: VA\nGóc nhìn: 178°/ 178°\nTần số quét: 200Hz\nThời gian phản hồi: 1 ms', '(29.5inch/WFHD/IPS/200Hz/1ms/300nits/HDMI+DP+USB+Audio/Loa/Freesync)\nTUF Gaming VG30VQL1A là màn hình chơi game cong 29,5 inch WFHD (2560 x 1080) 1500R với tốc độ làm mới 200 Hz cực nhanh và thời gian phản hồi 1 ms (MPRT) cho trải nghiệm chơi game cực kỳ đắm chìm. Nó có công nghệ Extreme Low Motion Blur (ELMB) độc quyền và AMD FreeSync ™ Premium để loại bỏ hiện tượng bóng mờ và xé hình. Ngoài ra, nó còn có công nghệ Dải động cao, hỗ trợ định dạng HDR10 và bao phủ 127% gam màu sRGB cho độ tương phản tuyệt vời và màu sắc sống động như thật.\n\nĐộ cong 1500R\nTUF Gaming VG30VQL1A mang đến hình ảnh tuyệt đẹp từ mọi góc độ với độ cong 1500R đảm bảo mọi điểm đều đều với mắt bạn. Với tốc độ làm mới 200Hz làm giảm độ trễ và nhòe chuyển động để mang lại cho bạn ưu thế trong các game bắn súng góc nhìn thứ nhất, các tay đua, chiến lược thời gian thực và các tựa game thể thao. Tốc độ làm mới cực nhanh này cho phép bạn chơi ở cài đặt hình ảnh cao nhất và cho phép bạn phản ứng ngay lập tức với những gì trên màn hình – vì vậy bạn sẽ nhận được cú đánh đầu tiên.\n\n', 11, 4.40, 5, '2025-11-16 01:30:00'),
(20, 'SSD ADATA SU650 120GB SATA (ASU650SS-120GT-R)', 'SSD-ADATA-SU650-120GB-SATA', 'Adata', 'Ổ cứng SSD Samsung 990 EVO Plus PCIe Gen 4.0 x4 NVMe 1TB là giải pháp lưu trữ tiên tiến, mang đến tốc độ vượt trội và hiệu năng ổn định cho mọi hệ thống. Với giao diện PCIe Gen 4.0, sản phẩm đạt tốc độ đọc tuần tự lên đến 7.250MB/s và tốc độ ghi 6.300MB/s, giúp tối ưu hóa thời gian tải ứng dụng cùng xử lý dữ liệu. Ổ cứng SSD 1TB đáp ứng nhu cầu lưu trữ lớn, đồng thời duy trì mức tiêu thụ điện năng hiệu quả, đảm bảo trải nghiệm liền mạch cho người dùng.', 'Hiệu suất tốc độ cao với PCIe Gen 4.0: Đạt tốc độ đọc 7.250MB/s, ghi 6.300MB/s, tối ưu cho game và ứng dụng nặng, giảm thời gian chờ đáng kể.\nDung lượng lưu trữ 1TB linh hoạt: Cung cấp không gian rộng lớn để cài đặt hệ điều hành, ứng dụng và lưu trữ mọi dữ liệu cá nhân, chuyên nghiệp.\nTiết kiệm năng lượng hiệu quả: Chỉ tiêu thụ 4.3W khi đọc, 4.2W khi ghi, giúp kéo dài thời lượng pin laptop và giảm tải cho hệ thống.\nĐộ bền bỉ và ổn định vượt trội: Với 1.5 triệu giờ MTBF, đảm bảo hoạt động liên tục, bảo vệ dữ liệu an toàn trong mọi điều kiện sử dụng.', 30, 4.90, 15, '2025-11-16 01:35:00'),
(21, 'HDD WD 18TB Ultrastar DC HC550 (3.5 inch, 7200RPM, SATA, 512MB cache) (WUH721818ALE6L4)', 'HDD-WD-18TB-Ultrastar', 'WD', '- Dung lượng: 18TB\n- Kích thước: 3.5\"\n- Kết nối: SATA 3\n- NAND: Không\n- Tốc độ vòng quay: 7200RPM\n- Cache: 512MB', '- Dung lượng: 18TB\n- Kích thước: 3.5\"\n- Kết nối: SATA 3\n- NAND: Không\n- Tốc độ vòng quay: 7200RPM\n- Cache: 512MB\n\n \n\nCapacity: 18TB\nForm Factor: 3.5-Inch\nInterface: SATA\nTransfer Rate: up to 269MB/s\nDisk Speed: 7200 RPM\nRecording Technology: EAMR\nCache Size: 512MB\nSecurity: SE\nDimensions: 147mm x 101.6mm x 26.1mm\nWeight: 690gms\nModel: 0F38459', 17, 4.60, 7, '2025-11-16 01:40:00'),
(22, 'HDD WD My Passport 1TB 2.5\" USB 3.2 (WDBYVG0010BBK-WESN)', 'HDD-WD-My-Passport-1TB', 'WD', '- Dung lượng: 1TB\n- Kích thước: 2.5\"\n- Kết nối: USB 3.2\n- NAND: Không', 'Ổ My Passport là bộ lưu trữ di động đáng tin cậy, mang đến cho bạn sự tự tin lưu trữ. Với thiết kế mới, sành điệu nằm gọn trong lòng bàn tay, có không gian để lưu trữ, sắp xếp và chia sẻ ảnh, video, nhạc và tài liệu của bạn. Được kết hợp hoàn hảo với phần mềm WD Backup ™ và bảo vệ mật khẩu, ổ đĩa My Passport giúp giữ an toàn cho nội dung cuộc sống số của bạn.', 13, 3.00, 1, '2025-11-16 01:45:00');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `product_categories`
--

CREATE TABLE `product_categories` (
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `category_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `product_categories`
--

INSERT INTO `product_categories` (`product_id`, `category_id`) VALUES
(1, 1),
(2, 1),
(3, 3),
(4, 1),
(5, 1),
(6, 1),
(7, 2),
(8, 2),
(9, 2),
(10, 3),
(11, 3),
(12, 3),
(13, 1),
(14, 1),
(15, 1),
(16, 1),
(17, 2),
(18, 2),
(19, 2),
(20, 3),
(21, 3),
(22, 3);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `product_comments`
--

CREATE TABLE `product_comments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `author_name` varchar(255) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `product_comments`
--

INSERT INTO `product_comments` (`id`, `product_id`, `author_name`, `content`, `created_at`) VALUES
(1, 1, 'bảo', 'sjkdfbjbsf', '2025-11-15 17:07:09'),
(2, 22, 'abc', 'good', '2025-11-21 16:28:22');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `product_images`
--

CREATE TABLE `product_images` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `image_url` varchar(1024) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `product_images`
--

INSERT INTO `product_images` (`id`, `product_id`, `image_url`, `sort_order`) VALUES
(1, 1, 'https://via.placeholder.com/800x600?text=Product+Image+1', 1),
(2, 2, 'https://via.placeholder.com/800x600?text=Product+Image+1', 1),
(3, 3, 'https://via.placeholder.com/800x600?text=Product+Image+1', 1),
(4, 1, 'https://via.placeholder.com/800x600?text=Product+Image+2', 2),
(5, 2, 'https://cdn.tgdd.vn/Products/Images/44/311178/asus-vivobook-go-15-e1504fa-r5-nj776w-glr-1-750x500.jpg', 2),
(6, 3, 'https://cdn.tgdd.vn/Products/Images/44/311178/asus-vivobook-go-15-e1504fa-r5-nj776w-glr-1-750x500.jpg', 2),
(7, 1, 'https://via.placeholder.com/800x600?text=Product+Image+3', 3),
(8, 2, 'https://via.placeholder.com/800x600?text=Product+Image+3', 3),
(9, 3, 'https://via.placeholder.com/800x600?text=Product+Image+3', 3),
(10, 4, 'https://via.placeholder.com/800x600?text=DevPro+15+1', 1),
(11, 4, 'https://via.placeholder.com/800x600?text=DevPro+15+2', 2),
(12, 4, 'https://via.placeholder.com/800x600?text=DevPro+15+3', 3),
(13, 5, 'https://via.placeholder.com/800x600?text=Gaming+Max+15+1', 1),
(14, 5, 'https://via.placeholder.com/800x600?text=Gaming+Max+15+2', 2),
(15, 5, 'https://via.placeholder.com/800x600?text=Gaming+Max+15+3', 3),
(16, 6, 'https://via.placeholder.com/800x600?text=Office+13+1', 1),
(17, 6, 'https://via.placeholder.com/800x600?text=Office+13+2', 2),
(18, 6, 'https://via.placeholder.com/800x600?text=Office+13+3', 3),
(19, 7, 'https://via.placeholder.com/800x600?text=Gaming+32+1', 1),
(20, 7, 'https://via.placeholder.com/800x600?text=Gaming+32+2', 2),
(21, 7, 'https://via.placeholder.com/800x600?text=Gaming+32+3', 3),
(22, 8, 'https://via.placeholder.com/800x600?text=Office+24+1', 1),
(23, 8, 'https://via.placeholder.com/800x600?text=Office+24+2', 2),
(24, 8, 'https://via.placeholder.com/800x600?text=Office+24+3', 3),
(25, 9, 'https://via.placeholder.com/800x600?text=UltraWide+34+1', 1),
(26, 9, 'https://via.placeholder.com/800x600?text=UltraWide+34+2', 2),
(27, 9, 'https://via.placeholder.com/800x600?text=UltraWide+34+3', 3),
(28, 10, 'https://via.placeholder.com/800x600?text=SSD+SATA+512+1', 1),
(29, 10, 'https://via.placeholder.com/800x600?text=SSD+SATA+512+2', 2),
(30, 10, 'https://via.placeholder.com/800x600?text=SSD+SATA+512+3', 3),
(31, 11, 'https://via.placeholder.com/800x600?text=HDD+2TB+1', 1),
(32, 11, 'https://via.placeholder.com/800x600?text=HDD+2TB+2', 2),
(33, 11, 'https://via.placeholder.com/800x600?text=HDD+2TB+3', 3),
(34, 12, 'https://via.placeholder.com/800x600?text=SSD+NVMe+2TB+1', 1),
(35, 12, 'https://via.placeholder.com/800x600?text=SSD+NVMe+2TB+2', 2),
(36, 12, 'https://via.placeholder.com/800x600?text=SSD+NVMe+2TB+3', 3),
(37, 13, 'https://via.placeholder.com/800x600?text=Laptop+Ultra+14+1', 1),
(38, 13, 'https://via.placeholder.com/800x600?text=Laptop+Ultra+14+2', 2),
(39, 13, 'https://via.placeholder.com/800x600?text=Laptop+Ultra+14+3', 3),
(40, 14, 'https://via.placeholder.com/800x600?text=Laptop+Creator+16+1', 1),
(41, 14, 'https://via.placeholder.com/800x600?text=Laptop+Creator+16+2', 2),
(42, 14, 'https://via.placeholder.com/800x600?text=Laptop+Creator+16+3', 3),
(43, 15, 'https://via.placeholder.com/800x600?text=Laptop+Budget+15+1', 1),
(44, 15, 'https://via.placeholder.com/800x600?text=Laptop+Budget+15+2', 2),
(45, 15, 'https://via.placeholder.com/800x600?text=Laptop+Budget+15+3', 3),
(46, 16, 'https://via.placeholder.com/800x600?text=Laptop+Business+14+1', 1),
(47, 16, 'https://via.placeholder.com/800x600?text=Laptop+Business+14+2', 2),
(48, 16, 'https://via.placeholder.com/800x600?text=Laptop+Business+14+3', 3),
(49, 17, 'https://via.placeholder.com/800x600?text=Monitor+4K+27+Pro+1', 1),
(50, 17, 'https://via.placeholder.com/800x600?text=Monitor+4K+27+Pro+2', 2),
(51, 17, 'https://via.placeholder.com/800x600?text=Monitor+4K+27+Pro+3', 3),
(52, 18, 'https://via.placeholder.com/800x600?text=Monitor+Gaming+27+144Hz+1', 1),
(53, 18, 'https://via.placeholder.com/800x600?text=Monitor+Gaming+27+144Hz+2', 2),
(54, 18, 'https://via.placeholder.com/800x600?text=Monitor+Gaming+27+144Hz+3', 3),
(55, 19, 'https://via.placeholder.com/800x600?text=Monitor+USB-C+24+1', 1),
(56, 19, 'https://via.placeholder.com/800x600?text=Monitor+USB-C+24+2', 2),
(57, 19, 'https://via.placeholder.com/800x600?text=Monitor+USB-C+24+3', 3),
(58, 20, 'https://via.placeholder.com/800x600?text=SSD+NVMe+512+1', 1),
(59, 20, 'https://via.placeholder.com/800x600?text=SSD+NVMe+512+2', 2),
(60, 20, 'https://via.placeholder.com/800x600?text=SSD+NVMe+512+3', 3),
(61, 21, 'https://via.placeholder.com/800x600?text=SSD+Portable+1TB+1', 1),
(62, 21, 'https://via.placeholder.com/800x600?text=SSD+Portable+1TB+2', 2),
(63, 21, 'https://via.placeholder.com/800x600?text=SSD+Portable+1TB+3', 3),
(64, 22, 'https://via.placeholder.com/800x600?text=HDD+4TB+7200+1', 1),
(65, 22, 'https://via.placeholder.com/800x600?text=HDD+4TB+7200+2', 2),
(66, 22, 'https://via.placeholder.com/800x600?text=HDD+4TB+7200+3', 3),
(67, 1, 'fontend/assets/products/asus-vivobook-go-15-e1504fa-r5-nj776w-glr-3-750x500.jpg\r\n', 1);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `product_ratings`
--

CREATE TABLE `product_ratings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `stars` tinyint(4) NOT NULL CHECK (`stars` between 1 and 5),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `product_ratings`
--

INSERT INTO `product_ratings` (`id`, `product_id`, `user_id`, `stars`, `created_at`) VALUES
(1, 1, 14, 5, '2025-11-15 17:07:26'),
(3, 22, 5, 3, '2025-11-21 16:29:10');

-- --------------------------------------------------------

--
-- Cấu trúc đóng vai cho view `product_rating_summary`
-- (See below for the actual view)
--
CREATE TABLE `product_rating_summary` (
`product_id` bigint(20) unsigned
,`total_reviews` bigint(21)
,`avg_rating` decimal(6,2)
);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `product_variants`
--

CREATE TABLE `product_variants` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `attrs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attrs`)),
  `price` bigint(20) NOT NULL,
  `stock` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `product_variants`
--

INSERT INTO `product_variants` (`id`, `product_id`, `sku`, `attrs`, `price`, `stock`) VALUES
(1, 1, 'Laptop-Dell-Inspiron-15-3530-A', '{\"ram\": \"16GB\", \"ssd\": \"512GB\"}', 18990000, 10),
(2, 2, 'dell-15-dc15255-A', '{\"ram\": \"16GB\", \"ssd\": \"512GB\"}', 18990000, 10),
(3, 3, 'SSD-Adata-LEGEND-710-A', '{\"ram\": \"16GB\", \"ssd\": \"512GB\"}', 8990000, 10),
(4, 1, 'Laptop-Dell-Inspiron-15-3530-B', '{\"ram\": \"32GB\", \"ssd\": \"1TB\"}', 23990000, 5),
(5, 2, 'dell-15-dc15255-B', '{\"ram\": \"32GB\", \"ssd\": \"1TB\"}', 23990000, 5),
(6, 3, 'SSD-Adata-LEGEND-710-B', '{\"ram\": \"32GB\", \"ssd\": \"1TB\"}', 9990000, 5),
(7, 4, 'del-alienware-16-aurora-A', '{\"ram\":\"16GB\",\"ssd\":\"512GB\"}', 20990000, 10),
(8, 4, 'del-alienware-16-aurora-B', '{\"ram\":\"32GB\",\"ssd\":\"1TB\"}', 25990000, 6),
(9, 5, 'Laptop-Asus-Vivobook-\nGo-15-E1504FA', '{\"ram\":\"16GB\",\"ssd\":\"512GB\",\"gpu\":\"RTX 4050\"}', 25990000, 8),
(10, 5, 'Laptop-Asus-Vivobook-\nGo-15-E1504FB', '{\"ram\":\"32GB\",\"ssd\":\"1TB\",\"gpu\":\"RTX 4060\"}', 29990000, 4),
(11, 6, 'asus-tuf-gaming-f16-A', '{\"ram\":\"8GB\",\"ssd\":\"256GB\"}', 13990000, 12),
(12, 6, 'asus-tuf-gaming-f16-B', '{\"ram\":\"16GB\",\"ssd\":\"512GB\"}', 16990000, 7),
(13, 7, 'monitor-dell-u2520d-A', '{\"size\":\"32\",\"hz\":\"144\"}', 7990000, 15),
(14, 7, 'monitor-dell-u2520d-B', '{\"size\":\"32\",\"hz\":\"165\"}', 8990000, 9),
(15, 8, 'monitor-dell-p2419hc-23-8inch-ips-A', '{\"size\":\"24\",\"hz\":\"75\"}', 3990000, 20),
(16, 8, 'monitor-dell-p2419hc-23-8inch-ips-B', '{\"size\":\"24\",\"hz\":\"60\"}', 3590000, 10),
(17, 9, 'monitor-gaming-asus-tuf-A', '{\"size\":\"34\",\"hz\":\"75\"}', 9990000, 5),
(18, 9, 'monitor-gaming-asus-tuf-B', '{\"size\":\"34\",\"hz\":\"100\"}', 11990000, 3),
(19, 10, 'SSD-ADATA-2.5\"-SU650-SATA-A', '{\"capacity\":\"512GB\",\"type\":\"SATA\"}', 1290000, 27),
(20, 10, 'SSD-ADATA-2.5\"-SU650-SATA-B', '{\"capacity\":\"512GB\",\"type\":\"SATA Pro\"}', 1590000, 18),
(21, 11, 'HDD-WD-RED-PLUS-A', '{\"capacity\":\"2TB\",\"rpm\":\"7200\"}', 1590000, 22),
(22, 11, 'HDD-WD-RED-PLUS-B', '{\"capacity\":\"2TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 1890000, 10),
(23, 12, 'SSD-ADATA-LEGEND-860-A', '{\"capacity\":\"2TB\",\"gen\":\"4\"}', 4990000, 6),
(24, 12, 'SSD-ADATA-LEGEND-860-B', '{\"capacity\":\"2TB\",\"gen\":\"4\",\"heatsink\":true}', 5490000, 4),
(25, 13, 'hp-15-fc0085au-A', '{\"ram\":\"16GB\",\"ssd\":\"512GB\"}', 18990000, 10),
(26, 13, 'hp-15-fc0085au-B', '{\"ram\":\"32GB\",\"ssd\":\"1TB\"}', 23990000, 6),
(27, 14, 'hp-victus-15-A', '{\"ram\":\"16GB\",\"ssd\":\"512GB\",\"gpu\":\"RTX 4050\"}', 26990000, 8),
(28, 14, 'hp-victus-15-B', '{\"ram\":\"32GB\",\"ssd\":\"1TB\",\"gpu\":\"RTX 4060\"}', 30990000, 5),
(29, 15, 'acer-nitro-v-15-A', '{\"ram\":\"8GB\",\"ssd\":\"256GB\"}', 11990000, 15),
(30, 15, 'acer-nitro-v-15-B', '{\"ram\":\"16GB\",\"ssd\":\"512GB\"}', 13990000, 9),
(31, 16, 'acer-aspire-lite-16-ai-A', '{\"ram\":\"16GB\",\"ssd\":\"512GB\"}', 19990000, 11),
(32, 16, 'acer-aspire-lite-16-ai-B', '{\"ram\":\"16GB\",\"ssd\":\"1TB\",\"lte\":true}', 22990000, 7),
(33, 17, 'monitor-asus-vz27ehf-A', '{\"size\":\"27\",\"resolution\":\"4K\",\"hz\":\"60\"}', 8990000, 10),
(34, 17, 'monitor-asus-vz27ehf-B', '{\"size\":\"27\",\"resolution\":\"4K\",\"hz\":\"144\"}', 10990000, 6),
(35, 18, 'monitor-asus-va229hr-7-A', '{\"size\":\"27\",\"hz\":\"144\"}', 6990000, 14),
(36, 18, 'monitor-asus-va229hr-7-B', '{\"size\":\"27\",\"hz\":\"165\"}', 7990000, 9),
(37, 19, 'monitor-asus-vg30vq1a-6-A', '{\"size\":\"24\",\"hz\":\"75\",\"usbc\":true}', 4590000, 18),
(38, 19, 'monitor-asus-vg30vq1a-6-B', '{\"size\":\"24\",\"hz\":\"60\",\"usbc\":true}', 4290000, 12),
(39, 20, 'SSD-ADATA-SU650-120GB-SATA-A', '{\"capacity\":\"512GB\",\"gen\":\"4\"}', 1590000, 25),
(40, 20, 'SSD-ADATA-SU650-120GB-SATA-B', '{\"capacity\":\"512GB\",\"gen\":\"4\",\"pro\":1}', 1890000, 15),
(41, 21, 'HDD-WD-18TB-Ultrastar-A', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\"}', 2590000, 15),
(42, 21, 'HDD-WD-18TB-Ultrastar-B', '{\"capacity\":\"1TB\",\"interface\":\"USB-C\",\"ip67\":1}', 2990000, 9),
(43, 22, 'HDD-WD-My-Passport-1TB-A', '{\"capacity\":\"4TB\",\"rpm\":\"7200\"}', 2490000, 5),
(44, 22, 'HDD-WD-My-Passport-1TB-B', '{\"capacity\":\"4TB\",\"rpm\":\"7200\",\"cache\":\"256MB\"}', 2790000, 4);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `email` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `provider` enum('local','google') NOT NULL DEFAULT 'local',
  `google_id` varchar(255) DEFAULT NULL,
  `role` enum('customer','admin') NOT NULL DEFAULT 'customer',
  `is_banned` tinyint(1) NOT NULL DEFAULT 0,
  `loyalty_points` int(255) NOT NULL DEFAULT 0,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_exp` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `users`
--

INSERT INTO `users` (`id`, `email`, `full_name`, `password_hash`, `provider`, `google_id`, `role`, `is_banned`, `loyalty_points`, `reset_token`, `reset_token_exp`, `created_at`, `updated_at`) VALUES
(5, 'admin1@gmail.com', 'trần thị b', '$2b$10$2btpm4wMJNjOjyKfrafKcOAMAf/5kOVZTvkFq34.bDHyPolnobUuS', 'local', NULL, 'admin', 0, 0, NULL, NULL, '2025-11-13 19:22:45', '2025-11-25 00:37:32'),
(14, '523h0007@student.tdtu.edu.vn', 'Trần Nguyên Bảo', NULL, 'google', '115213376163178009251', 'customer', 0, 0, '37c0bc7b24d941202195b738e3ced8ea3cde6817a3a28c95', '2025-11-21 20:58:34', '2025-11-15 15:54:36', '2025-11-21 20:28:34'),
(15, 'abc1@gmail.com', 'Nam', '$2y$10$/2tlWTSUmE/WXXFqp/5KJOvkYVIp2M99CAzfqDrR9fu3J0.akHzem', 'local', NULL, 'customer', 0, 0, NULL, NULL, '2025-11-21 17:47:17', '2025-11-26 15:44:04'),
(17, 'a@gmail.com', 'tnb', '$2b$10$DlTGqCZlqgmalTb9avAnyOZm7U9FEyJxxopOYoGTVbgJzwU1IDzVm', 'local', NULL, 'customer', 0, 0, NULL, NULL, '2025-11-27 05:25:48', '2025-11-27 05:25:48'),
(20, 'ngbao150205@gmail.com', 'jkasdjb', '$2b$10$hQ5452wD3dJf4R4Onw88aOK7KC4uD4lQoVLWS561M7yGsV5Qbhqii', 'local', NULL, 'customer', 0, 2259, NULL, NULL, '2025-11-27 06:08:23', '2025-11-29 18:41:40'),
(21, 'abcd1@gmail.com', 'Ngọc Dung', NULL, 'local', NULL, 'customer', 0, 0, NULL, NULL, '2025-11-28 14:19:51', '2025-11-28 14:19:51'),
(22, 'cc@gmail.com', 'ádbasd', NULL, 'local', NULL, 'customer', 0, 0, NULL, NULL, '2025-11-28 16:00:15', '2025-11-29 17:38:47');

-- --------------------------------------------------------

--
-- Cấu trúc cho view `product_rating_summary`
--
DROP TABLE IF EXISTS `product_rating_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `product_rating_summary`  AS SELECT `r`.`product_id` AS `product_id`, count(0) AS `total_reviews`, round(avg(`r`.`stars`),2) AS `avg_rating` FROM `product_ratings` AS `r` GROUP BY `r`.`product_id` ;

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `addresses`
--
ALTER TABLE `addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_addresses_user` (`user_id`);

--
-- Chỉ mục cho bảng `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Chỉ mục cho bảng `discount_codes`
--
ALTER TABLE `discount_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_discount_code` (`code`);

--
-- Chỉ mục cho bảng `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order` (`order_id`);

--
-- Chỉ mục cho bảng `order_status_history`
--
ALTER TABLE `order_status_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_osh_order` (`order_id`);

--
-- Chỉ mục cho bảng `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Chỉ mục cho bảng `product_categories`
--
ALTER TABLE `product_categories`
  ADD PRIMARY KEY (`product_id`,`category_id`),
  ADD KEY `fk_pc_c` (`category_id`);

--
-- Chỉ mục cho bảng `product_comments`
--
ALTER TABLE `product_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pcmt_p` (`product_id`);

--
-- Chỉ mục cho bảng `product_images`
--
ALTER TABLE `product_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pi_p` (`product_id`);

--
-- Chỉ mục cho bảng `product_ratings`
--
ALTER TABLE `product_ratings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_rating_once` (`product_id`,`user_id`),
  ADD KEY `fk_pr_u` (`user_id`);

--
-- Chỉ mục cho bảng `product_variants`
--
ALTER TABLE `product_variants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `fk_pv_p` (`product_id`);

--
-- Chỉ mục cho bảng `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `addresses`
--
ALTER TABLE `addresses`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT cho bảng `categories`
--
ALTER TABLE `categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `discount_codes`
--
ALTER TABLE `discount_codes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT cho bảng `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT cho bảng `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT cho bảng `order_status_history`
--
ALTER TABLE `order_status_history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT cho bảng `products`
--
ALTER TABLE `products`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT cho bảng `product_comments`
--
ALTER TABLE `product_comments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `product_images`
--
ALTER TABLE `product_images`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=75;

--
-- AUTO_INCREMENT cho bảng `product_ratings`
--
ALTER TABLE `product_ratings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT cho bảng `product_variants`
--
ALTER TABLE `product_variants`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=59;

--
-- AUTO_INCREMENT cho bảng `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- Các ràng buộc cho các bảng đã đổ
--

--
-- Các ràng buộc cho bảng `addresses`
--
ALTER TABLE `addresses`
  ADD CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `order_status_history`
--
ALTER TABLE `order_status_history`
  ADD CONSTRAINT `fk_osh_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `product_categories`
--
ALTER TABLE `product_categories`
  ADD CONSTRAINT `fk_pc_c` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pc_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `product_comments`
--
ALTER TABLE `product_comments`
  ADD CONSTRAINT `fk_pcmt_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `product_images`
--
ALTER TABLE `product_images`
  ADD CONSTRAINT `fk_pi_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `product_ratings`
--
ALTER TABLE `product_ratings`
  ADD CONSTRAINT `fk_pr_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pr_u` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `product_variants`
--
ALTER TABLE `product_variants`
  ADD CONSTRAINT `fk_pv_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
