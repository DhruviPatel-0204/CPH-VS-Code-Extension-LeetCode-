def two_sum(nums, target):
    """
    Finds two numbers in a list that add up to a target value.

    Args:
        nums: A list of integers.
        target: The target sum.

    Returns:
        A list containing the indices of the two numbers that add up to the target,
        or [-1, -1] if no such pair exists.
    """
    num_map = {}  # Dictionary for efficient lookups
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    return [-1, -1]


if __name__ == "__main__":

    nums = list(map(int, input().split()))
    target = int(input())

    result = two_sum(nums, target)
    print(result[0], result[1])
