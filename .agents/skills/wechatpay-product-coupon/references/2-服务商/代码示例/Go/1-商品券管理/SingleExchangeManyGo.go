package main

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/service_models_and_client.go
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import (
	"demo/wxpay_utility" // 引用微信支付工具库
	"encoding/json"
	"fmt"
)

// 创建商品券 - 场景5：多次优惠-单品-兑换券
//
// 场景说明：单品券（适用于指定商品）+ 兑换券（用户支付固定金额兑换指定商品）+ 阶梯模式（可多次使用）
//
// 关键参数：
// - scope = SINGLE（单品券，兑换券仅支持单品券）
// - type = EXCHANGE（兑换券）
// - usage_mode = PROGRESSIVE_BUNDLE（阶梯模式）

func main() {
	// TODO: 请准备商户开发必要参数
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",                 // 商户号
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CreateProductCouponRequest{
		OutRequestNo: wxpay_utility.String("MANY_SINGLE_EXCHANGE_20250101_005"), // 必填，创建请求单号，6-40个字符，品牌侧需保持唯一性
		BrandId:      wxpay_utility.String("120344"),                            // 必填，品牌ID，由微信支付分配
		OutProductNo: wxpay_utility.String("Product_1234567890"),                // 选填，商户侧商品券唯一标识
		Scope:        PRODUCTCOUPONSCOPE_SINGLE.Ptr(),                           // 必填，优惠范围：SINGLE-单品券(兑换券仅支持单品券)
		Type:         PRODUCTCOUPONTYPE_EXCHANGE.Ptr(),                          // 必填，商品券类型：NORMAL-满减券, DISCOUNT-折扣券, EXCHANGE-兑换券(仅单品券)
		UsageMode:    USAGEMODE_PROGRESSIVE_BUNDLE.Ptr(),                        // 必填，使用模式：SINGLE-单券, PROGRESSIVE_BUNDLE-多次优惠
		// 条件必填，多次优惠模式配置信息(当usage_mode=PROGRESSIVE_BUNDLE时必填)
		ProgressiveBundleUsageInfo: &ProgressiveBundleUsageInfo{
			Count:        wxpay_utility.Int64(3), // 必填，可使用次数，最少3次，最多15次
			IntervalDays: wxpay_utility.Int64(7), // 选填，多次优惠使用间隔天数(7表示每周可兑换一次)，最高7天，默认0
		},
		// 必填，商品券展示信息
		DisplayInfo: &ProductCouponDisplayInfo{
			Name:          wxpay_utility.String("9.9元兑换原价99商品(可用3次)"),                   // 必填，商品券名称，最多12个字符
			ImageUrl:      wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 必填，商品券图片URL
			BackgroundUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，背景图URL
			DetailImageUrlList: []string{ // 选填，详情图URL列表，最多6张
				"https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx",
			},
			OriginalPrice: wxpay_utility.Int64(9900), // 条件必填(单品券)，商品原价(单位：分)，与combo_package_list二选一
			// 条件必填(单品券)，套餐组合列表，与original_price二选一
			ComboPackageList: []ComboPackage{
				{
					Name:      wxpay_utility.String("超值兑换套餐"), // 必填，套餐名称
					PickCount: wxpay_utility.Int64(3),         // 必填，可选商品数量
					ChoiceList: []ComboPackageChoice{ // 必填，可选商品列表
						{
							Name:     wxpay_utility.String("汉堡"),                                           // 必填，商品名称
							Price:    wxpay_utility.Int64(1500),                                             // 必填，商品价格(单位：分)
							Count:    wxpay_utility.Int64(1),                                                // 必填，商品数量
							ImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/burger"), // 必填，商品图片URL
						},
						{
							Name:     wxpay_utility.String("鸡翅"),                                           // 必填，商品名称
							Price:    wxpay_utility.Int64(1200),                                             // 必填，商品价格(单位：分)
							Count:    wxpay_utility.Int64(1),                                                // 必填，商品数量
							ImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/wings"), // 必填，商品图片URL
						},
						{
							Name:     wxpay_utility.String("可乐"),                                          // 必填，商品名称
							Price:    wxpay_utility.Int64(500),                                             // 必填，商品价格(单位：分)
							Count:    wxpay_utility.Int64(1),                                               // 必填，商品数量
							ImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/cola"),  // 必填，商品图片URL
						},
					},
				},
			},
		},
		// 条件必填，批次信息(当usage_mode=PROGRESSIVE_BUNDLE时必填)
		Stock: createExchangeStockPtr("9.9元兑换批次", 0, 990),
	}

	response, err := CreateProductCoupon(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}
	fmt.Printf("请求成功: %+v\n", response)
}

// createExchangeStockPtr 创建兑换券批次(返回指针)
func createExchangeStockPtr(remark string, threshold, exchangePrice int64) *StockForProgressiveBundle {
	stock := createExchangeStock(remark, threshold, exchangePrice)
	return &stock
}

// createExchangeStock 创建兑换券批次
func createExchangeStock(remark string, threshold, exchangePrice int64) StockForProgressiveBundle {
	return StockForProgressiveBundle{
		Remark:         wxpay_utility.String(remark),
		CouponCodeMode: COUPONCODEMODE_WECHATPAY.Ptr(),
		StockSendRule: &StockSendRule{
			MaxCount:        wxpay_utility.Int64(10000000),
			MaxCountPerUser: wxpay_utility.Int64(1),
		},
		ProgressiveBundleUsageRule: &ProgressiveBundleUsageRule{
			CouponAvailablePeriod: &CouponAvailablePeriod{
				AvailableBeginTime: wxpay_utility.String("2025-08-01T00:00:00+08:00"),
				AvailableEndTime:   wxpay_utility.String("2025-08-31T23:59:59+08:00"),
				AvailableDays:      wxpay_utility.Int64(30),
				WeeklyAvailablePeriod: &FixedWeekPeriod{
					DayList: []WeekEnum{
						WEEKENUM_MONDAY,
						WEEKENUM_TUESDAY,
						WEEKENUM_WEDNESDAY,
						WEEKENUM_THURSDAY,
						WEEKENUM_FRIDAY,
						WEEKENUM_SATURDAY,
						WEEKENUM_SUNDAY,
					},
				},
			},
			ExchangeCoupon: &ExchangeCouponUsageRule{
				Threshold:     wxpay_utility.Int64(threshold),
				ExchangePrice: wxpay_utility.Int64(exchangePrice),
			},
		},
		UsageRuleDisplayInfo: &UsageRuleDisplayInfo{
			CouponUsageMethodList: []CouponUsageMethod{
				COUPONUSAGEMETHOD_OFFLINE,
				COUPONUSAGEMETHOD_MINI_PROGRAM,
				COUPONUSAGEMETHOD_PAYMENT_CODE,
			},
			MiniProgramAppid: wxpay_utility.String("wx1234567890"),
			MiniProgramPath:  wxpay_utility.String("/pages/index/product"),
			UsageDescription: wxpay_utility.String("用9.9元兑换原价99元商品"),
			CouponAvailableStoreInfo: &CouponAvailableStoreInfo{
				Description:      wxpay_utility.String("所有门店可用，可使用小程序查看门店列表"),
				MiniProgramAppid: wxpay_utility.String("wx1234567890"),
				MiniProgramPath:  wxpay_utility.String("/pages/index/store-list"),
			},
		},
		CouponDisplayInfo: &CouponDisplayInfo{
			CodeDisplayMode: COUPONCODEDISPLAYMODE_QRCODE.Ptr(),
			BackgroundColor: wxpay_utility.String("Color010"),
			EntranceMiniProgram: &EntranceMiniProgram{
				Appid:           wxpay_utility.String("wx1234567890"),
				Path:            wxpay_utility.String("/pages/index/product"),
				EntranceWording: wxpay_utility.String("立即兑换"),
				GuidanceWording: wxpay_utility.String("获取更多优惠"),
			},
			EntranceOfficialAccount: &EntranceOfficialAccount{
				Appid: wxpay_utility.String("wx1234567890"),
			},
			EntranceFinder: &EntranceFinder{
				FinderId:                 wxpay_utility.String("gh_12345678"),
				FinderVideoId:            wxpay_utility.String("UDFsdf24df34dD456Hdf34"),
				FinderVideoCoverImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"),
			},
		},
		StoreScope: STOCKSTORESCOPE_NONE.Ptr(),
		NotifyConfig: &NotifyConfig{
			NotifyAppid: wxpay_utility.String("wx4fd12345678"),
		},
	}
}
