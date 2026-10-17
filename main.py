def is_prime(number):
    if number < 2:
        return False

    for divisor in range(2, int(number ** 0.5) + 1):
        if number % divisor == 0:
            return False

    return True


primes = [number for number in range(1, 101) if is_prime(number)]
print(primes)
